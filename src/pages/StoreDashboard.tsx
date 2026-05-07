/**
 * Store Owner Dashboard
 * Main page for store owners to manage their store, printers, pricing, and payment history
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStoreOwner } from "@/hooks/useStoreOwner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { LogOut, Loader2, AlertCircle, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Import dashboard components (we'll create these next)
import { StoreInfoTab } from "./dashboard/StoreInfoTab";
import { PrinterManagementTab } from "./dashboard/PrinterManagementTab";
import { PricingManagementTab } from "./dashboard/PricingManagementTab";
import { StoreSettingsTab } from "./dashboard/StoreSettingsTab";
import { PaymentHistoryTab } from "./dashboard/PaymentHistoryTab";

export const StoreDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { store, isStoreOwner, loading: storeLoading } = useStoreOwner();
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!storeLoading && !isStoreOwner) {
      navigate("/", { replace: true });
      toast.error("You need to be a store owner to access this page");
    }
  }, [storeLoading, isStoreOwner, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  if (authLoading || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="size-12 mx-auto text-red-500" />
            <h2 className="text-xl font-semibold">No Store Found</h2>
            <p className="text-sm text-muted-foreground">
              Your user account is not linked to a store. Please contact support.
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Go Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-xl sticky top-0 z-10 bg-background/60">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center">
              <Store className="size-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">{store.name}</p>
              <p className="text-xs text-muted-foreground">{store.store_uid}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px]">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
              <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-4xl">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Store Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your store settings, printers, pricing, and payment history.
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="info">Store Info</TabsTrigger>
            <TabsTrigger value="printers">Printers</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          {/* Store Info Tab */}
          <TabsContent value="info" className="space-y-4">
            <StoreInfoTab store={store} />
          </TabsContent>

          {/* Printers Tab */}
          <TabsContent value="printers" className="space-y-4">
            <PrinterManagementTab storeId={store.id} />
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-4">
            <PricingManagementTab storeId={store.id} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <StoreSettingsTab store={store} />
          </TabsContent>

          {/* Payment History Tab */}
          <TabsContent value="payments" className="space-y-4">
            <PaymentHistoryTab storeId={store.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default StoreDashboard;
