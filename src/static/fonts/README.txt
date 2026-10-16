hanken-grotesk.woff2: Hanken Grotesk (variable, weight axis kept), Latin subset.
Copyright 2021 The Hanken Grotesk Project Authors (https://github.com/marcologous/hanken-grotesk)
Licensed under the SIL Open Font License 1.1, see OFL.txt. The font is served from this site only.

Glyphs: U+0020-007E, U+00A0-00FF (includes the multiplication sign U+00D7), U+2013, U+2014, U+2018, U+2019, U+201C, U+201D, U+2022, U+2026 and the arrow U+2192.
Name table: IDs 0-6 (copyright, family, version), 13 (license description), 14 (license URL) and 256-267 (variation axis and instance names).
Layout features: kern, liga, ss01.

Rebuild from HankenGrotesk-VariableFont_wght.ttf (google/fonts, ofl/hankengrotesk), with fonttools and brotli installed:

pyftsubset HankenGrotesk-VariableFont_wght.ttf \
  --unicodes=U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+2192 \
  --layout-features=kern,liga,ss01 \
  --name-IDs=0,1,2,3,4,5,6,13,14,256,257,258,259,260,261,262,263,264,265,266,267 \
  --flavor=woff2 \
  --output-file=hanken-grotesk.woff2
