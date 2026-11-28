# Listo – własna aplikacja z kontami i synchronizacją

Po tych krokach będziesz mieć:

- **stronę www** z Listo (np. `https://twoj-login.github.io/listo/`), którą każdy zainstaluje na telefonie jak aplikację,
- **instalator Windows** (`Listo_1.0.0_x64-setup.exe`) – prawdziwa aplikacja w menu Start, bez przeglądarki,
- **konta użytkowników** – każdy ma swoje prywatne zadania, zsynchronizowane między jego urządzeniami.

Wszystko jest darmowe. Zajmie ok. 15–20 minut. Kod i aplikacja są gotowe – trzeba tylko założyć dwa konta i kliknąć kilka rzeczy.

---

## Krok 1. Serwer z kontami – Supabase (5 min)

1. Wejdź na **supabase.com** → *Start your project* → zaloguj się (najprościej kontem GitHub z kroku 3 albo e-mailem).
2. *New project*:
   - **Name:** `listo`
   - **Database Password:** wygeneruj i zapisz w menedżerze haseł (nie będzie potrzebne w aplikacji)
   - **Region:** *Central EU (Frankfurt)*
   - kliknij *Create new project* i poczekaj ok. 2 minuty.
3. W menu po lewej: **SQL Editor** → *New query* → wklej całą zawartość pliku `supabase/schema.sql` → **Run**.
   Powinno pojawić się *Success. No rows returned*.
4. **Project Settings → API** (lub *Data API*). Skopiuj:
   - **Project URL** (np. `https://abcdefghijk.supabase.co`)
   - **anon public** key (długi ciąg zaczynający się od `eyJ…`)
5. Otwórz plik **`config.js`** w folderze `listo` i wklej oba w cudzysłowy:
   ```js
   supabaseUrl: 'https://abcdefghijk.supabase.co',
   supabaseKey: 'eyJhbGciOi…',
   ```
   (Możesz też po prostu wkleić mi te dwie wartości w czacie – uzupełnię plik za Ciebie.)
   > Klucz **anon public** jest bezpieczny do umieszczenia w aplikacji. **Nigdy** nie wklejaj klucza `service_role`.

## Krok 2. Konto GitHub i wysłanie plików (5 min)

1. Załóż konto na **github.com** (jeśli nie masz).
2. Zainstaluj **GitHub Desktop** (desktop.github.com) i zaloguj się w nim.
3. W GitHub Desktop: **File → Add local repository** → wybierz folder `listo`
   → kliknij *create a repository* → **Create repository**.
4. Kliknij **Publish repository**, **odznacz** *Keep this code private* → **Publish**.
   (Darmowe strony GitHub Pages działają dla publicznych repozytoriów. W repozytorium nie ma żadnych Twoich zadań ani haseł – zadania są tylko w Supabase, chronione kontami.)

## Krok 3. Włącz stronę i budowanie instalatora (2 min + ok. 10 min czekania)

1. Na github.com otwórz swoje repozytorium `listo` → **Settings → Pages** → *Source*: **GitHub Actions**.
2. Zakładka **Actions** → *Zbuduj Listo* → **Run workflow** (albo poczekaj – uruchamia się po każdym *Push*).
3. Po ok. 10 minutach:
   - adres strony zobaczysz w *Settings → Pages* (np. `https://twoj-login.github.io/listo/`),
   - instalator znajdziesz w **Releases** (prawa kolumna repozytorium) → `Listo_…_x64-setup.exe`.

## Krok 4. Dokończ ustawienia logowania (1 min)

1. W `config.js` wpisz adres strony w `siteUrl` (np. `'https://twoj-login.github.io/listo/'`), a w GitHub Desktop: *Commit to main* → **Push origin**.
2. W Supabase: **Authentication → URL Configuration**:
   - **Site URL:** adres Twojej strony,
   - **Redirect URLs:** dodaj ten sam adres.
   Dzięki temu linki z e-maili (potwierdzenie konta, reset hasła) otworzą Listo.
3. (Opcjonalnie) **Authentication → Sign In / Providers → Email** – wyłącz *Confirm email*, jeśli nie chcesz potwierdzania adresu przy rejestracji.

## Krok 5. Przenieś swoje obecne zadania

1. W starym Listo (wersja w claude.ai): **Ustawienia → Konto i urządzenia → Kopiuj**.
2. W nowej aplikacji: załóż konto i zaloguj się → **Ustawienia → Konto i urządzenia → Wklej** → zatwierdź.

## Instalacja na urządzeniach

| Urządzenie | Jak |
|---|---|
| **Windows** | Pobierz `…-setup.exe` z *Releases* i uruchom. Jeśli pojawi się „System Windows ochronił komputer” → *Więcej informacji* → *Uruchom mimo to* (aplikacja nie ma płatnego podpisu cyfrowego). |
| **Android** | Otwórz adres strony w Chrome → menu ⋮ → **Zainstaluj aplikację**. |
| **iPhone / iPad** | Otwórz adres strony w Safari → **Udostępnij** → **Do ekranu początkowego**. |
| **Mac / Linux / inny komputer** | Otwórz stronę w Chrome lub Edge → ikona instalacji w pasku adresu (albo *Ustawienia → Konto i urządzenia → Zainstaluj*). |

## Udostępnianie innym

Wyślij znajomym link do strony (telefon) i/lub do *Releases* (Windows). Każdy zakłada **własne konto** –
ma swoje, osobne zadania i własną synchronizację między swoimi urządzeniami. Nikt nie widzi cudzych danych.

## Aktualizacje

Każda zmiana w plikach + *Commit* i *Push* w GitHub Desktop = po kilku minutach nowa wersja strony
i nowy instalator w *Releases*. Telefony same pobiorą nową wersję przy następnym uruchomieniu.

## Dobrze wiedzieć

- **Darmowy plan Supabase** wstrzymuje projekt po 7 dniach **zupełnego braku** użycia. Wystarczy normalnie korzystać z Listo,
  a jeśli projekt się wstrzyma – w panelu Supabase kliknij *Restore*. Dane nie znikają.
- Aplikacja działa także **offline** – zmiany wyślą się, gdy wróci internet.
- Wersja w claude.ai i skróty na tym komputerze nadal działają niezależnie (osobne dane).

---

## Krok 6. Powiadomienia przy zamkniętej aplikacji (ok. 5 min, jednorazowo)

Przypomnienia działają od razu, gdy Listo jest otwarte. Żeby przychodziły też na zamkniętą aplikację
(telefon, komputer), Supabase musi je wysyłać – służy do tego mała funkcja `listo-push`.

1. W Supabase: **Edge Functions → Deploy a new function → Via Editor**.
2. Nazwa funkcji: **`listo-push`** (dokładnie tak).
3. Usuń przykładowy kod, wklej całą zawartość pliku `supabase/functions/listo-push/index.ts` → **Deploy function**.
4. Po wdrożeniu otwórz funkcję → **Details** (lub *Settings*) → wyłącz **Verify JWT** / *Enforce JWT verification* → zapisz.
   (Funkcja sama sprawdza tajny klucz harmonogramu – nikt z zewnątrz nie może jej wywołać do wysyłki.)
5. **SQL Editor → New query** → wklej całość `supabase/push.sql` → **Run**.
   Tworzy tabele (każdy widzi tylko swoje dane) i harmonogram, który co minutę wywołuje funkcję.
6. W Listo: **Ustawienia → Powiadomienia → Włącz** (na każdym urządzeniu osobno).
   Na iPhonie najpierw zainstaluj Listo z Safari („Do ekranu początkowego”) i włącz powiadomienia w aplikacji otwartej z ikony.
7. Kliknij **Test z serwera** i zamknij aplikację – powiadomienie przyjdzie w ciągu ok. minuty.
