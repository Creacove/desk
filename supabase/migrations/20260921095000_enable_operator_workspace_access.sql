-- Enable the Desk operator workspace picker after provisioning the first
-- reviewed operator account.
update private.operator_access_config
set enabled = true,
    updated_at = now(),
    updated_by = 'cedbcee6-66c5-4e04-830c-ad2e0c63990a'
where singleton = true;
