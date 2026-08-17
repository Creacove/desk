from pathlib import Path

path = Path('src/features/manager/OpportunityArtifact.tsx')
text = path.read_text()
old = '''function ContactLink({ contact }: { contact: NonNullable<ReleaseOpportunityTargetViewModel["publicContact"]> }) {
  const href = contact.kind === "email" ? `mailto:${contact.value}` : contact.kind === "phone" ? `tel:${contact.value}` : contact.value;
  return <a href={href} target={contact.kind === "url" ? "_blank" : undefined} rel={contact.kind === "url" ? "noreferrer" : undefined} className="font-semibold text-foreground underline decoration-foreground/20 underline-offset-2">{contact.value}</a>;
}'''
new = '''function ContactLink({ contact }: { contact: NonNullable<ReleaseOpportunityTargetViewModel["publicContact"]> }) {
  const isEmail = contact.kind === "email";
  const href = isEmail ? `mailto:${contact.value}` : contact.value;
  return <a href={href} target={isEmail ? undefined : "_blank"} rel={isEmail ? undefined : "noreferrer"} className="font-semibold text-foreground underline decoration-foreground/20 underline-offset-2">{contact.value}</a>;
}'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'Expected one ContactLink implementation, found {count}')
path.write_text(text.replace(old, new, 1))
print('Aligned opportunity contact links with canonical public-contact types.')
