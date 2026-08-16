-- 044_add_sms_invalid_phone_status.sql
-- Phone numbers are now validated as real Tanzanian numbers before an SMS
-- send is even attempted (sms.service.js#dispatch) — a request with a
-- clearly malformed number is rejected before wasting a Beem API call, and
-- that outcome needs its own honest log status distinct from
-- 'skipped_not_configured'/'failed' so an admin reviewing sms_logs can see
-- exactly why a message never went out. Purely additive to the existing
-- enum from 039_create_sms_logs_table.sql — no old migration edited.
ALTER TABLE sms_logs
  MODIFY COLUMN status ENUM('sent','failed','skipped_not_configured','skipped_rate_limited','skipped_invalid_phone') NOT NULL;
