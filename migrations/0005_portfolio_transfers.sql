ALTER TABLE portfolio_transactions DROP CONSTRAINT IF EXISTS portfolio_transactions_type_check;
ALTER TABLE portfolio_transactions ADD CONSTRAINT portfolio_transactions_type_check CHECK(type IN ('BUY','SELL','DIVIDEND','DEPOSIT','WITHDRAWAL','SPLIT','TRANSFER_IN','TRANSFER_OUT'));
