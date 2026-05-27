-- SQL Recovery Script
-- ---------------------------------------------------------------------------------
-- 1. Επαναφορά των σωστών υπολοίπων στους λογαριασμούς σου
-- (Επειδή είχαν διαγραφεί, η εφαρμογή δημιούργησε νέα με μηδέν. Τρέξε αυτό για να επανέλθουν)
-- ---------------------------------------------------------------------------------
UPDATE public.accounts SET balance = 9016.06 WHERE name = 'Cash' AND user_id = 'c13f513d-b588-472b-86f8-2f5c1227dd13';
UPDATE public.accounts SET balance = 38476.91 WHERE name = 'Bank Account' AND user_id = 'c13f513d-b588-472b-86f8-2f5c1227dd13';
UPDATE public.accounts SET balance = -36776.92 WHERE name = 'Card' AND user_id = 'c13f513d-b588-472b-86f8-2f5c1227dd13';
UPDATE public.accounts SET balance = 0.0 WHERE name = 'ETF, ΜΕΤΟΧΕΣ' AND user_id = 'c13f513d-b588-472b-86f8-2f5c1227dd13';
