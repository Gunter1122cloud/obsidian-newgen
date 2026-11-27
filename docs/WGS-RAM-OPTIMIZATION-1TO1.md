# WGS RAM Optimization — kötelező 1:1 átvétel

Döntés (2026-11-27): az Obsidian Command NewGen RAM-optimalizálását a felhasználó által átadott WGS-main.zip alapján, az eredeti működéssel kell átvenni. Nem újratervezés. Az eredeti kód és licenc itt referencia; ez a dokumentum nem implementáció.

Upstream: https://github.com/MadBee71/WGS

## Eredeti motor — változtatás nélkül

`WGS/Services/ServerManagerService.cs`, 93–94. sor:

```csharp
    [DllImport("psapi.dll", SetLastError = true)]
    private static extern bool EmptyWorkingSet(IntPtr hProcess);
```

Ugyanazon fájl, 529–538. sor:

```csharp
        if (_config.OptimizeRamBeforeStart)
        {
            GC.Collect(GC.MaxGeneration, GCCollectionMode.Forced, blocking: true);
            try
            {
                foreach (var p in Process.GetProcesses())
                    try { EmptyWorkingSet(p.Handle); } catch { }
            }
            catch { }
        }
```

Az eredeti hívás közvetlenül a szerverfolyamat elindítása előtt történik (540–543. sor: startedUtc, try, proc.Start()). A .NET GC a Manager saját memóriájára vonatkozik; az EmptyWorkingSet az elérhető folyamatok fizikai working setjét csökkentheti, nem garantál privátcommit-megtakarítást.

## Eredeti beállítás és UI

`WGS/Services/ConfigService.cs`:

- 96. sor: `public bool   OptimizeRamBeforeStart { get; set; } = false;`
- 154. sor: `bool   OptimizeRamBeforeStart = false,`
- 191. sor: `OptimizeRamBeforeStart   = d.OptimizeRamBeforeStart;`
- 211. sor: az OptimizeRamBeforeStart átadása a mentendő beállítások között.

`WGS/ViewModels/SettingsViewModel.cs`:

- 111. sor: `[ObservableProperty] private bool   _optimizeRamBeforeStart;`
- 238. sor: `OptimizeRamBeforeStart    = _config.OptimizeRamBeforeStart;`
- 308. sor: `_config.OptimizeRamBeforeStart   = OptimizeRamBeforeStart;`

`WGS/Views/SettingsView.xaml`, 36–39. sor:

```xml
                    <CheckBox IsChecked="{Binding OptimizeRamBeforeStart}" Style="{StaticResource DarkCheckBox}"
                              Content="Optimize system RAM before starting a server" Margin="0,14,0,0"/>
                    <TextBlock Text="Flushes unused memory from background processes before each server launch to free up physical RAM. May cause a brief pause."
                               FontSize="11" Foreground="{StaticResource TextMutedBrush}" TextWrapping="Wrap" Margin="0,4,0,0"/>
```

## Kötelező implementációs keret

- Az eredeti natív hívás, algoritmus, időzítés, hatókör és alapértelmezett false érték változatlan.
- Egy globális beállítás, szerverindítás előtt, az összes elérhető helyi folyamatra, ahogyan a WGS-ben.
- Csak az Obsidian meglévő beállításmentéséhez, felületéhez és indítási útvonalához szükséges technikai illesztés megengedett.
- Nincs új küszöbérték, ütemező, indítás utáni trim, maponkénti kapcsoló, kézi gomb, játékosszám-ellenőrzés, extra jóváhagyás, memóriaprioritás, watchdog, RCON, plugin, mod, adatbázis vagy más új funkció.
- A WGS megoldásának globális hatóköre és az esetleges rövid akadás ismert; ne állítsunk garantált RAM- vagy CPU-megtakarítást.
- Az eredeti MIT copyright és licenc maradjon meg az átvett kód terjesztésekor.
- A jelenlegi feladat csak a döntés és az eredeti referencia mentése. Nincs futó szerver módosítás, restart, memóriaürítés vagy alkalmazáskód-módosítás.

## Eredeti MIT licenc (WGS-main/LICENSE)

```text
MIT License

Copyright (c) 2025 Windows Game Server Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## NewGen technical adaptation

NewGen is Electron/TypeScript, not .NET. The original C# body executes via the built-in Windows PowerShell immediately before the existing process factory launches a server. The GC call therefore collects the helper's .NET heap, not the Electron manager's heap. The global EmptyWorkingSet loop and default-off behavior are unchanged. No additional optimization policies.
