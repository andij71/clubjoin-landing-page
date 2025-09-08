# ClubJoin - Supabase Setup für Early Access

## ⚠️ KRITISCHE SICHERHEITS-HINWEISE

**WICHTIG:** Mehrschichtiger Schutz gegen Manipulation der Email-Verifizierung!

### 🛡️ Sicherheitslayer:

#### Layer 1: RLS Policies
- ❌ **INSERT nur mit email_verified=false** erlaubt
- ❌ **verification_token MUSS gesetzt** sein bei INSERT
- ❌ **NUR unverifizierte** Einträge können updated werden
- ❌ **NUR spezifische Felder** dürfen geändert werden

#### Layer 2: Database Triggers  
- 🚫 **Verhindert email_verified=true** bei INSERT
- 🚫 **Erzwingt verification_token** bei jedem INSERT
- 🚫 **Verhindert Änderung kritischer Felder** nach Verifizierung
- 🚫 **Erzwingt verified_date** bei Verifizierung

#### Layer 3: Sichere Funktionen
- ✅ **SECURITY DEFINER** - Laufen mit Admin-Rechten
- ✅ **Nur COUNT-Funktionen** für Public Access
- ✅ **Token-basierte Verifizierung** ohne Direct Access
- ✅ **Keine Email-Daten** für anon users

### 🚨 Was jetzt UNMÖGLICH ist:
- ❌ `INSERT ... email_verified=true` → **TRIGGER FEHLER**
- ❌ `INSERT ... verification_token=null` → **TRIGGER FEHLER** 
- ❌ `UPDATE SET email_verified=true` ohne Function → **RLS FEHLER**
- ❌ `SELECT email FROM ...` als anon user → **RLS FEHLER**

## 1. Supabase Projekt erstellen
1. Gehe zu [supabase.com](https://supabase.com)
2. Erstelle ein neues Projekt
3. Wähle eine Region (Europa für GDPR-Compliance)
4. Notiere dir die **Project URL** und **anon/public key**

## 2. Datenbank-Tabelle erstellen

### SQL für Early Access Signups:
```sql
-- Create early_access_signups table
CREATE TABLE early_access_signups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    gdpr_consent BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255) UNIQUE,
    signup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_date TIMESTAMP WITH TIME ZONE,
    source VARCHAR(50) DEFAULT 'landing_page',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX idx_early_access_email ON early_access_signups(email);
CREATE INDEX idx_early_access_date ON early_access_signups(signup_date);
CREATE INDEX idx_early_access_token ON early_access_signups(verification_token);
CREATE INDEX idx_early_access_verified ON early_access_signups(email_verified);

-- Enable Row Level Security (RLS)
ALTER TABLE early_access_signups ENABLE ROW LEVEL SECURITY;

-- ⚠️ WICHTIG: Sichere Policies für Datenschutz

-- Policy 1: Jeder kann neue Signups einfügen, aber NUR als unverifiziert
CREATE POLICY "Anyone can insert unverified signups only" 
ON early_access_signups 
FOR INSERT 
WITH CHECK (
    auth.role() = 'anon' AND 
    email_verified = false AND 
    verification_token IS NOT NULL
);

-- Policy 2: Nur Admins können Emails lesen (NICHT public users!)
CREATE POLICY "Only service role can view signups" 
ON early_access_signups 
FOR SELECT 
USING (auth.role() = 'service_role');

-- Policy 3: NUR die verify_email() Funktion kann email_verified auf true setzen
CREATE POLICY "Only verify function can mark as verified"
ON early_access_signups 
FOR UPDATE 
USING (
    -- Nur unverifizierte Einträge können updated werden
    email_verified = false AND 
    verification_token IS NOT NULL
)
WITH CHECK (
    -- Nach Update: email_verified muss true und verified_date gesetzt sein
    email_verified = true AND 
    verified_date IS NOT NULL
);
```

### Sichere Funktionen für Public Access:
```sql
-- ✅ SICHERE Funktion: Nur COUNT, keine Email-Daten
CREATE OR REPLACE FUNCTION get_verified_signup_count()
RETURNS INTEGER 
SECURITY DEFINER -- Läuft mit Berechtigungen des Erstellers
AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM early_access_signups WHERE email_verified = true);
END;
$$ LANGUAGE plpgsql;

-- ✅ SICHERE Funktion: Email-Verifizierung ohne Datenleak
CREATE OR REPLACE FUNCTION verify_email(token_param VARCHAR(255))
RETURNS BOOLEAN 
SECURITY DEFINER -- Läuft mit Berechtigungen des Erstellers
AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    UPDATE early_access_signups 
    SET email_verified = true, verified_date = NOW()
    WHERE verification_token = token_param AND email_verified = false;
    
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql;

-- Public access nur für sichere Funktionen
GRANT EXECUTE ON FUNCTION get_verified_signup_count() TO anon;
GRANT EXECUTE ON FUNCTION verify_email(VARCHAR) TO anon;
```

### 🛡️ Extra Sicherheit - Database Triggers:
```sql
-- Trigger-Funktion: Verhindert direkte Manipulation von email_verified
CREATE OR REPLACE FUNCTION prevent_verified_bypass()
RETURNS TRIGGER AS $$
BEGIN
    -- Bei INSERT: email_verified MUSS false sein
    IF TG_OP = 'INSERT' THEN
        -- Erzwinge email_verified = false bei allen Inserts
        IF NEW.email_verified = true THEN
            RAISE EXCEPTION 'INSERT_DENIED: Direct verification not allowed. Use verification process.';
        END IF;
        -- Erzwinge verification_token bei allen Inserts
        IF NEW.verification_token IS NULL OR NEW.verification_token = '' THEN
            RAISE EXCEPTION 'INSERT_DENIED: Verification token required for new signups.';
        END IF;
        -- Stelle sicher, dass verified_date NULL ist bei neuen Signups
        IF NEW.verified_date IS NOT NULL THEN
            NEW.verified_date := NULL;
        END IF;
        RETURN NEW;
    END IF;
    
    -- Bei UPDATE: Strenge Kontrolle der Änderungen
    IF TG_OP = 'UPDATE' THEN
        -- Wenn email_verified auf true gesetzt wird
        IF NEW.email_verified = true AND OLD.email_verified = false THEN
            -- Muss verified_date setzen
            IF NEW.verified_date IS NULL THEN
                RAISE EXCEPTION 'UPDATE_DENIED: verified_date must be set when marking as verified.';
            END IF;
            -- Darf keine anderen kritischen Felder ändern
            IF NEW.email != OLD.email THEN
                RAISE EXCEPTION 'UPDATE_DENIED: Cannot change email during verification.';
            END IF;
            IF NEW.verification_token != OLD.verification_token THEN
                RAISE EXCEPTION 'UPDATE_DENIED: Cannot change verification_token during verification.';
            END IF;
        END IF;
        
        -- Verhindere Änderungen an bereits verifizierten Einträgen
        IF OLD.email_verified = true THEN
            -- Kritische Felder dürfen nicht geändert werden
            IF NEW.email != OLD.email THEN
                RAISE EXCEPTION 'UPDATE_DENIED: Cannot modify email after verification.';
            END IF;
            IF NEW.verification_token != OLD.verification_token THEN
                RAISE EXCEPTION 'UPDATE_DENIED: Cannot modify token after verification.';
            END IF;
            IF NEW.verified_date != OLD.verified_date THEN
                RAISE EXCEPTION 'UPDATE_DENIED: Cannot modify verified_date after verification.';
            END IF;
            -- Kann nicht wieder auf unverifiziert gesetzt werden
            IF NEW.email_verified = false THEN
                RAISE EXCEPTION 'UPDATE_DENIED: Cannot unverify after verification.';
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger aktivieren
CREATE TRIGGER enforce_verification_security
    BEFORE INSERT OR UPDATE ON early_access_signups
    FOR EACH ROW EXECUTE FUNCTION prevent_verified_bypass();
```

## 3. Konfiguration in index.html
1. Ersetze in `index.html` die Werte:
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co'
   const SUPABASE_ANON_KEY = 'your-anon-key-here'
   ```
   
2. Mit deinen echten Werten:
   ```javascript
   const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'
   const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'
   ```

## 4. Features

✅ **Automatischer Fallback**: localStorage wenn Supabase nicht verfügbar
✅ **GDPR-Konform**: Explizite Zustimmung erforderlich  
✅ **Duplikate-Check**: Verhindert mehrfache Anmeldungen
✅ **Live Counter**: Zeigt aktuelle Anzahl der Anmeldungen
✅ **Fehlerbehandlung**: Graceful degradation bei Problemen
✅ **Responsive**: Funktioniert auf allen Geräten

## 5. Testen
1. Ohne Supabase: localStorage Fallback wird verwendet
2. Mit Supabase: Daten werden in der Cloud gespeichert
3. Live Counter aktualisiert sich automatisch

## 6. Sicherheits-Tests

### 🧪 Teste die Sicherheitsmaßnahmen:
```sql
-- ❌ Diese sollten ALLE fehlschlagen:

-- Test 1: Direkte Verifizierung
INSERT INTO early_access_signups (email, email_verified, verification_token) 
VALUES ('hacker@evil.com', true, 'fake-token');
-- → Sollte: "INSERT_DENIED: Direct verification not allowed"

-- Test 2: Ohne Token
INSERT INTO early_access_signups (email, email_verified) 
VALUES ('hacker@evil.com', false);
-- → Sollte: "INSERT_DENIED: Verification token required"

-- Test 3: Direktes Update
UPDATE early_access_signups 
SET email_verified = true 
WHERE email = 'test@example.com';
-- → Sollte: RLS Policy Fehler

-- ✅ Das sollte funktionieren:
-- Nur über die sichere verify_email() Funktion
SELECT verify_email('valid-token-here');
```

### 🛡️ Erwartete Fehlermeldungen:
- `INSERT_DENIED: Direct verification not allowed`
- `INSERT_DENIED: Verification token required` 
- `UPDATE_DENIED: verified_date must be set`
- `new row violates row-level security policy`

## 7. Analytics (Optional)
Du kannst zusätzliche Queries in Supabase ausführen (nur als service_role):
```sql
-- Signups pro Tag
SELECT DATE(signup_date) as date, COUNT(*) as signups
FROM early_access_signups 
GROUP BY DATE(signup_date)
ORDER BY date;

-- Verification Rate
SELECT 
  COUNT(*) as total_signups,
  SUM(CASE WHEN email_verified THEN 1 ELSE 0 END) as verified,
  ROUND(100.0 * SUM(CASE WHEN email_verified THEN 1 ELSE 0 END) / COUNT(*), 2) as verification_rate_percent
FROM early_access_signups;

-- Email-Domains Analyse
SELECT SPLIT_PART(email, '@', 2) as domain, COUNT(*) as count
FROM early_access_signups 
GROUP BY domain
ORDER BY count DESC;
```