/**
 * Printer Management Tab Component
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Printer {
  id: string;
  store_id: string;
  printer_type: "color" | "bw" | "micro";
  name: string;
  is_active: boolean;
}

export const PrinterManagementTab = ({ storeId }: { storeId: string }) => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newPrinter, setNewPrinter] = useState({
    name: "",
    printer_type: "color" as "color" | "bw" | "micro",
  });
  const [open, setOpen] = useState(false);

  // Load printers on mount
  useEffect(() => {
    loadPrinters();
  }, [storeId]);

  const loadPrinters = async () => {
    try {
      const { data, error } = await supabase
        .from("printers")
        .select("*")
        .eq("store_id", storeId)
        .order("printer_type, name");

      if (error) throw error;
      setPrinters(data || []);
    } catch (error: any) {
      console.error("Error loading printers:", error);
      toast.error("Failed to load printers");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrinter = async () => {
    if (!newPrinter.name.trim()) {
      toast.error("Please enter a printer name");
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from("printers").insert({
        store_id: storeId,
        name: newPrinter.name,
        printer_type: newPrinter.printer_type,
        is_active: true,
      });

      if (error) throw error;
      toast.success("Printer added successfully");
      setNewPrinter({ name: "", printer_type: "color" });
      setOpen(false);
      loadPrinters();
    } catch (error: any) {
      console.error("Error adding printer:", error);
      toast.error(error.message || "Failed to add printer");
    } finally {
      setAdding(false);
    }
  };

  const handleDeletePrinter = async (id: string) => {
    try {
      const { error } = await supabase.from("printers").delete().eq("id", id);

      if (error) throw error;
      toast.success("Printer deleted");
      setDeleteId(null);
      loadPrinters();
    } catch (error: any) {
      console.error("Error deleting printer:", error);
      toast.error("Failed to delete printer");
    }
  };

  const printerCounts = {
    color: printers.filter((p) => p.printer_type === "color" && p.is_active).length,
    bw: printers.filter((p) => p.printer_type === "bw" && p.is_active).length,
    micro: printers.filter((p) => p.printer_type === "micro" && p.is_active).length,
  };

  const limits = { color: 6, bw: 7, micro: 5 };

  return (
    <div className="space-y-6">
      {/* Printer Limits */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Color Printers
          </p>
          <p className="text-2xl font-bold">
            {printerCounts.color}/{limits.color}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            B&W Printers
          </p>
          <p className="text-2xl font-bold">
            {printerCounts.bw}/{limits.bw}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Micro Printers
          </p>
          <p className="text-2xl font-bold">
            {printerCounts.micro}/{limits.micro}
          </p>
        </Card>
      </div>

      {/* Add Printer Button */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="size-4" />
            Add Printer
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Printer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="printer-name">Printer Name</Label>
              <Input
                id="printer-name"
                placeholder="e.g., Color Printer 1"
                value={newPrinter.name}
                onChange={(e) =>
                  setNewPrinter({ ...newPrinter, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="printer-type">Type</Label>
              <Select
                value={newPrinter.printer_type}
                onValueChange={(value) =>
                  setNewPrinter({
                    ...newPrinter,
                    printer_type: value as "color" | "bw" | "micro",
                  })
                }
              >
                <SelectTrigger id="printer-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="color">Color</SelectItem>
                  <SelectItem value="bw">Black & White</SelectItem>
                  <SelectItem value="micro">Micro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddPrinter}
              disabled={adding}
              className="w-full"
            >
              {adding ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Adding…
                </>
              ) : (
                "Add Printer"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Printers List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : printers.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No printers added yet</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {printers.map((printer) => (
            <Card key={printer.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{printer.name}</p>
                <p className="text-xs text-muted-foreground">
                  Type:{" "}
                  {printer.printer_type === "bw" ? "Black & White" : printer.printer_type}
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDeletePrinter(printer.id)}
                disabled={deleteId === printer.id}
              >
                {deleteId === printer.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
