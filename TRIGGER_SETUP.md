# Database Trigger für automatischen Email-Versand

## 🎯 Production-Empfehlung: Database Trigger

Für Production ist ein **Database Trigger** besser als Frontend-Trigger:

### **Warum Database Trigger?**
- ✅ **Zuverlässiger** - Läuft immer, auch wenn User Browser schließt
- ✅ **Automatisch** - Kein JavaScript-Code erforderlich
- ✅ **Retry-Logic** - Kann bei Fehlern automatisch wiederholen
- ✅ **Server-seitig** - Unabhängig vom Client

## 🔧 Setup: Database Trigger

### **1. HTTP Extension aktivieren:**
```sql
-- In Supabase SQL Editor ausführen:
CREATE EXTENSION IF NOT EXISTS http;
```

### **2. Trigger Function erstellen:**
```sql
CREATE OR REPLACE FUNCTION trigger_send_verification_email()
RETURNS TRIGGER AS $$
DECLARE
    response_status INTEGER;
    response_body TEXT;
BEGIN
    -- Log the trigger execution
    RAISE NOTICE 'Sending verification email for: %', NEW.email;
    
    -- Rufe Edge Function über HTTP auf
    SELECT status, content INTO response_status, response_body
    FROM http((
        'POST',
        'https://onhnpxenhsebpmxyvaah.supabase.co/functions/v1/send-verification-email',
        ARRAY[
            http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uaG5weGVuaHNlYnBteHl2YWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNzA2ODEsImV4cCI6MjA3Mjg0NjY4MX0.JnxdioSmWR72KXxCl2KyNPD2FILSqdmeaZfjUdi7bwE'),
            http_header('Content-Type', 'application/json')
        ],
        json_build_object(
            'email', NEW.email,
            'verificationToken', NEW.verification_token
        )::text
    ));
    
    -- Log the response
    IF response_status = 200 THEN
        RAISE NOTICE 'Email sent successfully for: %', NEW.email;
    ELSE
        RAISE WARNING 'Email sending failed for: %, Status: %, Body: %', NEW.email, response_status, response_body;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### **3. Trigger aktivieren:**
```sql
-- Trigger nach INSERT aktivieren
DROP TRIGGER IF EXISTS send_verification_after_signup ON early_access_signups;

CREATE TRIGGER send_verification_after_signup
    AFTER INSERT ON early_access_signups
    FOR EACH ROW
    WHEN (NEW.email_verified = false AND NEW.verification_token IS NOT NULL)
    EXECUTE FUNCTION trigger_send_verification_email();
```

### **4. JavaScript vereinfachen:**
```javascript
// Entferne Edge Function Aufruf aus Frontend
// index.html - Vereinfachte Version:

if (isSupabaseEnabled) {
    const { data, error } = await supabase
        .from('early_access_signups')
        .insert([{
            email: email,
            gdpr_consent: gdprConsent,
            email_verified: false,
            verification_token: verificationToken,
            signup_date: new Date().toISOString(),
            source: 'landing_page'
        }]);

    if (error) {
        // Handle error
    } else {
        console.log('✅ Signup successful - Email wird automatisch versendet');
        success = true;
        // Kein manueller Edge Function Aufruf mehr nötig!
    }
}
```

## 🧪 Testen:

### **1. Trigger testen:**
```sql
-- Test INSERT - sollte automatisch Email triggern
INSERT INTO early_access_signups (
    email, 
    email_verified, 
    verification_token, 
    gdpr_consent,
    source
) VALUES (
    'test@example.com', 
    false, 
    'test-token-12345',
    true,
    'manual_test'
);
```

### **2. Logs überprüfen:**
```sql
-- Supabase Logs Dashboard oder:
SELECT * FROM pg_stat_activity WHERE query LIKE '%trigger_send_verification_email%';
```

## 🔄 Migration Plan:

### **Phase 1: Hybrid (aktuell)**
- Frontend triggert Edge Function
- Funktioniert sofort

### **Phase 2: Database Trigger (empfohlen)**
- Database triggert automatisch
- JavaScript wird vereinfacht  
- Zuverlässiger für Production

### **Phase 3: Queue System (skaliert)**
- Database → Message Queue → Worker
- Für hohe Volumen

## 🚨 Wichtige Hinweise:

### **Security:**
- HTTP Extension hat Zugriff auf externe APIs
- Bearer Token in Trigger-Code speichern
- RLS Policies schützen vor Missbrauch

### **Performance:**
- HTTP Calls können Database verlangsamen
- Bei hohem Volumen Queue System verwenden
- Timeout-Handling implementieren

### **Debugging:**
- Trigger Logs in Supabase Dashboard
- RAISE NOTICE für Debug-Ausgaben
- Error Handling für failed HTTP Calls

## 🎯 **Empfehlung:**

**Aktuell:** Behalte Frontend-Trigger für Development
**Production:** Wechsle zu Database Trigger für Zuverlässigkeit

**Beide Systeme können parallel laufen - Database Trigger als Backup!**