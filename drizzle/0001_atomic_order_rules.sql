-- Keep validation, stock deduction, wallet movement and seat reservation in one
-- SQLite statement. A trigger failure rolls back every side effect.
CREATE TRIGGER validate_order BEFORE INSERT ON orders BEGIN
 SELECT CASE WHEN NEW.status != 'placed' THEN RAISE(ABORT,'INVALID_TRANSITION') END;
 SELECT CASE WHEN json_type(NEW.items)!='array' OR json_array_length(NEW.items)=0 THEN RAISE(ABORT,'OUT_OF_STOCK') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.items) j LEFT JOIN menu m ON m.id=json_extract(j.value,'$.id') WHERE m.id IS NULL OR json_extract(j.value,'$.quantity')<1 OR json_extract(j.value,'$.quantity')>10 OR json_type(j.value,'$.quantity')!='integer' OR m.stock<json_extract(j.value,'$.quantity')) THEN RAISE(ABORT,'OUT_OF_STOCK') END;
 SELECT CASE WHEN (SELECT count(*) FROM json_each(NEW.items)) != (SELECT count(DISTINCT json_extract(value,'$.id')) FROM json_each(NEW.items)) THEN RAISE(ABORT,'OUT_OF_STOCK') END;
 SELECT CASE WHEN NEW.total != (SELECT sum(m.price*json_extract(j.value,'$.quantity')) FROM json_each(NEW.items) j JOIN menu m ON m.id=json_extract(j.value,'$.id')) OR EXISTS(SELECT 1 FROM json_each(NEW.items) j JOIN menu m ON m.id=json_extract(j.value,'$.id') WHERE m.price!=json_extract(j.value,'$.price')) THEN RAISE(ABORT,'PRICE_CHANGED') END;
 SELECT CASE WHEN (SELECT balance FROM users WHERE id=NEW.user_id)<NEW.total THEN RAISE(ABORT,'INSUFFICIENT_COINS') END;
 SELECT CASE WHEN NEW.space_id IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM spaces WHERE id=NEW.space_id) OR EXISTS(SELECT 1 FROM spaces s JOIN users u ON u.id=NEW.user_id WHERE s.id=NEW.space_id AND s.department_id IS NOT NULL AND s.department_id!=u.department_id)) THEN RAISE(ABORT,'DEPARTMENT_RESTRICTED') END;
 SELECT CASE WHEN NEW.space_id IS NOT NULL AND (SELECT count(*) FROM orders WHERE space_id=NEW.space_id AND status IN ('placed','preparing','ready')) >= (SELECT capacity FROM spaces WHERE id=NEW.space_id) THEN RAISE(ABORT,'SPACE_FULL') END;
END;
--> statement-breakpoint
CREATE TRIGGER apply_order AFTER INSERT ON orders BEGIN
 UPDATE menu SET stock=stock-(SELECT json_extract(value,'$.quantity') FROM json_each(NEW.items) WHERE json_extract(value,'$.id')=menu.id) WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.items));
 INSERT INTO ledger(id,user_id,amount,description,actor_id) VALUES('order:'||NEW.id,NEW.user_id,-NEW.total,'Order '||upper(substr(NEW.id,1,8)),NEW.user_id);
END;
--> statement-breakpoint
CREATE TRIGGER apply_ledger AFTER INSERT ON ledger BEGIN
 UPDATE users SET balance=balance+NEW.amount WHERE id=NEW.user_id;
END;
--> statement-breakpoint
CREATE TRIGGER validate_transition BEFORE UPDATE OF status ON orders BEGIN
 SELECT CASE WHEN NOT ((OLD.status='placed' AND NEW.status IN ('preparing','cancelled')) OR (OLD.status='preparing' AND NEW.status='ready') OR (OLD.status='ready' AND NEW.status='completed')) THEN RAISE(ABORT,'INVALID_TRANSITION') END;
END;
--> statement-breakpoint
CREATE TRIGGER refund_order AFTER UPDATE OF status ON orders WHEN NEW.status='cancelled' BEGIN
 UPDATE menu SET stock=stock+(SELECT json_extract(value,'$.quantity') FROM json_each(OLD.items) WHERE json_extract(value,'$.id')=menu.id) WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(OLD.items));
 INSERT INTO ledger(id,user_id,amount,description,actor_id) VALUES('refund:'||OLD.id,OLD.user_id,OLD.total,'Refund '||upper(substr(OLD.id,1,8)),OLD.user_id);
END;
--> statement-breakpoint
CREATE TRIGGER immutable_ledger_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT,'LEDGER_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER immutable_ledger_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT,'LEDGER_IMMUTABLE'); END;
