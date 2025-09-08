# ClubJoin - Email Verification Setup

## 🎯 Double-Opt-In System implementiert

Das ClubJoin Early Access System verwendet jetzt Double-Opt-In für GDPR-Compliance und bessere Datenqualität.

## 📧 Wie funktioniert es?

### 1. **User Flow:**
1. User füllt Email + GDPR Consent aus
2. Email wird als **unverifiziert** in Supabase gespeichert mit verification_token
3. System zeigt "Bestätige deine Email" Nachricht 
4. User klickt Link in Email → `verify.html?token=xyz`
5. Email wird als verifiziert markiert
6. Nur **verifizierte** Emails zählen im Live Counter

### 2. **Database Schema:**
```sql
CREATE TABLE early_access_signups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    gdpr_consent BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,  -- ✅ NEU
    verification_token VARCHAR(255) UNIQUE, -- ✅ NEU  
    signup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_date TIMESTAMP WITH TIME ZONE, -- ✅ NEU
    source VARCHAR(50) DEFAULT 'landing_page'
);
```

## 🔧 Email-Versand implementieren

**Aktuell:** Email-Versand ist nur als Placeholder implementiert. Du musst noch einen Email-Service integrieren:

### Option 1: Supabase Edge Functions + Resend
```javascript
// In Supabase Edge Function
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const verificationUrl = `https://yourdomain.com/verify.html?token=${verificationToken}`

await resend.emails.send({
  from: 'noreply@clubjoin.io',
  to: email,
  subject: 'ClubJoin Early Access - Email bestätigen',
  html: `
    <h2>Willkommen bei ClubJoin!</h2>
    <p>Klicke auf den Link, um deine Email zu bestätigen:</p>
    <a href="${verificationUrl}">Email bestätigen</a>
  `
})
```

### Option 2: Webhook + externes Email-System
```javascript
// Nach Supabase Insert
await fetch('https://your-email-service.com/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: email,
    token: verificationToken,
    template: 'verification'
  })
})
```

## 📊 Live Counter - nur verifizierte Emails

Der Counter zeigt jetzt nur **verifizierte** User:
```javascript
const { data, error } = await supabase
    .from('early_access_signups')
    .select('id', { count: 'exact' })
    .eq('email_verified', true);  // ✅ Nur verifizierte
```

## 🛡️ GDPR Compliance

✅ **Explicit Consent** - Checkbox erforderlich  
✅ **Double Opt-In** - Email-Bestätigung erforderlich  
✅ **Data Minimization** - Nur notwendige Daten  
✅ **Right to Withdraw** - Abmelde-Möglichkeit  
✅ **Transparent Processing** - Klare Datenschutzerklärung  

## 🧪 Testen

### Lokales Testen:
1. Formular ausfüllen → sollte "Email bestätigen" Message zeigen
2. Supabase Dashboard → Entry mit `email_verified: false`
3. `verify.html?token=GENERATED_TOKEN` öffnen → sollte verifizieren
4. Counter sollte nur verifizierte Emails zählen

### Console Logs:
- `💾 Attempting Supabase save...`
- `📧 Verification email would be sent with token: xyz`
- `✅ Successfully saved to Supabase (pending verification)`

## 🚀 Nächste Schritte

1. **Email-Service konfigurieren** (Resend, SendGrid, etc.)
2. **Email-Template erstellen** (schönes HTML Design)  
3. **Supabase RLS Policies** für Admin-Zugriff
4. **Analytics Dashboard** für Conversion-Tracking
5. **A/B Testing** für Conversion-Optimierung

## 🔒 Sicherheit

- Verification Token: 256-bit kryptographisch sicher
- Tokens sind einmalig verwendbar
- Row Level Security (RLS) aktiviert
- Keine sensiblen Daten in URLs (nur Token)