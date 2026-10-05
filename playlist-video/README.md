# FGC 2025 — mecze ze streamów

`fgc_matches.py` przetwarza 15 streamów z podanej playlisty. Pobiera obraz bez
audio, odczytuje zegar przez OCR i wykrywa jego odliczanie. Każdy wykryty mecz
zapisuje jako osobny JSON oraz wpis w zbiorczym `matches.json`.

```json
{
  "url": "https://www.youtube.com/watch?v=Hy2VGJjoMoo",
  "start_timestamp": 265.0,
  "end_timestamp": 415.0
}
```

Timestampy to sekundy od początku filmu. Start oznacza start zegara gry,
koniec — dojście zegara do zera. Skrypt zakłada mecz trwający 150 sekund,
zgodnie z zegarem w tych transmisjach. Numeracja meczów nie jest rozpoznawana;
pliki identyfikuje ID filmu i timestamp startu. Powtórki pozostają osobnymi
wpisami.

## Uruchomienie

W katalogu zawierającym `fgc_matches.py` i `playlist.json`:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -U -r requirements.txt
.venv/bin/python fgc_matches.py --output results --cache cache
```

Wymagane są również `ffmpeg`, `ffprobe` i `tesseract` z językiem `eng` w PATH.
Na macOS można je zainstalować przez `brew install ffmpeg tesseract`.
Na komputerze, na którym powstał skrypt, wszystkie trzy programy są dostępne.
Używaj aktualnego `yt-dlp`; starsza lokalna wersja zwracała 403 przy pobieraniu.

Pełny przebieg pobiera wielogodzinne nagrania w 480p (z rezerwowym wyborem do
720p), więc wymaga wielu GB miejsca i czasu. Filmy i wyniki OCR pozostają
w cache. Ponowne uruchomienie z tym samym cache wykorzystuje gotowe dane.

Opcjonalne odświeżenie playlisty:

```bash
.venv/bin/python fgc_matches.py \
  --playlist 'https://www.youtube.com/playlist?list=PL-RL-gR4GAfdUMblMbZmF_AsT5X9M4ppt' \
  --output results --cache cache
```

Test jednego streamu:

```bash
.venv/bin/python fgc_matches.py --video-id Hy2VGJjoMoo \
  --output results-field1 --cache cache
```

Można również użyć własnego pobranego nagrania przez
`--video-id Hy2VGJjoMoo --local-video /sciezka/film.mp4`.
Jeśli plik jest fragmentem, `--offset 250` oznacza, że jego pierwsza klatka
odpowiada sekundzie 250 oryginalnego filmu. Używaj fragmentów z dokładnym
cięciem; zwykłe cięcie do najbliższej klatki kluczowej może przesunąć czas.

## Wyniki i kontrola

- `results/matches.json` — tablica wszystkich wykrytych meczów.
- `results/matches/<video_id>_<start>.json` — osobny plik każdego meczu.
- `results/report.json` — dzień, field, liczba odczytów zegara, błędy i
  `review_candidates`, czyli fragmenty z niewystarczającymi lub sprzecznymi
  odczytami zegara.

Zegar jest próbkowany co 10 sekund. Granice są wyliczane z zależności
`czas filmu + czas pozostały = koniec meczu`, a nie zaokrąglane do 10 sekund.
Wielokrotne zgodne odczyty muszą potwierdzić spadek zegara. Nieruchomy zegar
2:30 przed grą i 0:00 po grze nie tworzą meczów.

`report.json` ma `completeness_verified: false`: sam OCR nie dowodzi, że
odnaleziono wszystkie mecze. Zniknięcie nakładki, zmiana układu, zatrzymany
zegar lub transmisja zaczynająca się w trakcie meczu wymagają kontroli.
Przed importem całego turnieju porównaj liczbę wpisów z harmonogramem meczów
FGCScouta i sprawdź `review_candidates`. Skrypt nie dopisuje zgadywanych meczów.
Przesunięcie granic rzędu 1–2 sekund może wynikać z odczytu zegara na obrazie.

Kod wyjścia `2` oznacza błąd pobierania/przetwarzania lub stream bez wykrytych
meczów. Kod `0` oznacza pomyślne przetwarzanie; pełność listy nadal wymaga
porównania z harmonogramem. Dla różnych podzbiorów transmisji używaj osobnych
katalogów `--output`, ponieważ zbiorczy JSON obejmuje bieżące uruchomienie.

## Sprawdzone działanie

Skrypt uruchomiono na dokładnie wyciętym fragmencie `250–430 s` rzeczywistego
streamu Day 1 / Field 1. Wykrył jeden mecz `265–415 s`: 17 z 18 próbek miało
czytelny zegar, a 15 zgodnych odczytów potwierdziło granice. Osobno sprawdzono
klatki przy starcie i końcu: `266 s = 2:29`, `414 s = 0:01`, `415 s = 0:00`.
Wynik znajduje się w `example-result/`.

Potwierdzono taki sam układ zegara na próbkach Day 2 / Field 2 i
Day 3 / Field 5, zgodność wszystkich 15 ID z metadanymi playlisty oraz
odrzucanie nieruchomego zegara i wykrywanie kilku meczów w danych testowych.
Pełne przetwarzanie wszystkich 15 nagrań nie zostało wykonane.
