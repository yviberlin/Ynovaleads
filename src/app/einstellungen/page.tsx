import { getCurrentTenantId } from "@/lib/tenant";
import { getProfile } from "@/lib/settings";
import { aiAvailable } from "@/lib/score";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function Einstellungen() {
  const t = await getCurrentTenantId();
  const { saved, ...profile } = getProfile(t);
  const ai = aiAvailable();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Wunschkunden-Profil</h1>
          <p>Danach bewertet die KI deine Leads mit 1 bis 10 Punkten.</p>
        </div>
      </div>
      {!saved && <div className="notice" role="status">Das ist ein Vorschlag. Pass ihn an und speichere ihn, damit die Bewertung zu dir passt.</div>}
      {!ai.ok && <div className="notice error" role="alert">{ai.reason} Ohne Schlüssel kannst du das Profil schon speichern, aber noch nicht bewerten.</div>}
      <ProfileForm profile={profile} />
    </>
  );
}
