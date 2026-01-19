# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]: "Card Style:"
    - generic [ref=e6] [cursor=pointer]:
      - radio "Thin Border" [checked] [ref=e7]
      - text: Thin Border
    - generic [ref=e8] [cursor=pointer]:
      - radio "Thick Border" [ref=e9]
      - text: Thick Border
  - generic [ref=e10]: "Shader Effect:"
  - combobox "Shader Effect:" [ref=e11] [cursor=pointer]:
    - option "Base"
    - option "Holographic"
    - option "Foil"
    - option "Parallax"
    - option "Cracked Ice"
    - option "Refractor" [selected]
    - option "Galaxy Foil"
    - option "Starburst"
    - option "Prizm"
    - option "Etched Foil"
  - generic [ref=e12]: "Effect Mask:"
  - combobox "Effect Mask:" [ref=e13] [cursor=pointer]:
    - option "Full (No Mask)" [selected]
    - option "Border Only"
    - option "Center Only"
    - option "Art Window"
    - option "Radial Edge"
    - option "Radial Center"
```