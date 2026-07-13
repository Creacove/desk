const args = parseArgs(process.argv.slice(2));
const partner = args.partner?.trim();
const recipient = args.recipient?.trim();
const quantity = Number(args.quantity);

if (!partner || !recipient || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
  console.error('Usage: npm run beta:batch -- --partner "Name" --quantity 1 --recipient "person@example.com"');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/create-beta-invite-batch`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ partner, recipient, quantity }),
});
const result = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(result.error ?? `Batch creation failed with ${response.status}.`);
  process.exit(1);
}

console.log(`Batch: ${result.batchId}`);
console.log(`Seats: ${result.codeCount}`);
console.log(`Invitation expires: ${result.invitationExpiresAt}`);
console.log(`Email: ${result.emailStatus}`);
console.log("Codes (shown once; store and distribute securely):");
for (const code of result.codes ?? []) console.log(code);

function parseArgs(values) {
  const output = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]?.replace(/^--/, "");
    if (key) output[key] = values[index + 1];
  }
  return output;
}
