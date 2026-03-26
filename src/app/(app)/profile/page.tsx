import { getSession } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ProfilePage() {
  const session = await getSession();

  return (
    <div className="p-4">
      <div className="mx-auto max-w-sm space-y-6 pt-4">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Profile</h2>

          {session ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium text-foreground">{session.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <Badge className="mt-1 bg-clinic-teal text-white" variant="default">
                  {session.role}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not logged in.</p>
          )}
        </div>

        <form action={logout}>
          <Button
            type="submit"
            variant="destructive"
            className="w-full"
          >
            Log out
          </Button>
        </form>
      </div>
    </div>
  );
}
