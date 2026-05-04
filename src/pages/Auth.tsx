import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const signIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="p-8 max-w-sm w-full bg-card/60 backdrop-blur-xl border-border/60 space-y-6 text-center">
        <div className="size-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center glow">
          <Printer className="size-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to PrintBeam</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to upload and print.</p>
        </div>
        <Button className="w-full h-12" onClick={signIn}>
          Continue with Google
        </Button>
      </Card>
    </div>
  );
};

export default Auth;
