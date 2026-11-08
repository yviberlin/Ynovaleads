/**
 * Mandant (Tenant) = wem die Daten gehören.
 *
 * In der Master-Version gibt es nur einen Mandanten: "master".
 * Wenn später Kunden dazukommen, liefert diese Funktion den Mandanten
 * des eingeloggten Nutzers. Alle Datenbankzugriffe laufen schon heute
 * über eine tenantId, deshalb muss sonst nichts umgebaut werden.
 */
export const MASTER_TENANT_ID = "master";

export async function getCurrentTenantId(): Promise<string> {
  return MASTER_TENANT_ID;
}
