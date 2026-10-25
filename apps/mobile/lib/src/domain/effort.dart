/// Intensidad de cada tramo: porcentaje de la velocidad del test (el mismo de la Calculadora) y su
/// RPE. Copia de `packages/plan-library/src/rpe-scale.json` (un test verifica que sean iguales).
///
///   50–65 % → RPE 2–3 · 66–75 % → 4–5 · 76–85 % → 6–7 · 86–95 % → 8 · 96–100 % → 9 · más de 100 % → 10
library;

/// Banda: hasta [maxPct] inclusive corresponde [rpe]; [level] es el color (1 = más suave … 6).
typedef EffortBand = ({int maxPct, int rpe, int level});

const List<EffortBand> rpeBands = [
  (maxPct: 57, rpe: 2, level: 1),
  (maxPct: 65, rpe: 3, level: 1),
  (maxPct: 70, rpe: 4, level: 2),
  (maxPct: 75, rpe: 5, level: 2),
  (maxPct: 80, rpe: 6, level: 3),
  (maxPct: 85, rpe: 7, level: 3),
  (maxPct: 95, rpe: 8, level: 4),
  (maxPct: 100, rpe: 9, level: 5),
  (maxPct: 1000, rpe: 10, level: 6),
];

EffortBand _bandOf(num pct) {
  final p = pct.round();
  return rpeBands.firstWhere((b) => p <= b.maxPct, orElse: () => rpeBands.last);
}

/// RPE (1–10) de un porcentaje.
int rpeFor(num pct) => _bandOf(pct).rpe;

/// Nivel de color (1 = más suave … 6 = más intenso) de un porcentaje.
int effortLevel(num pct) => _bandOf(pct).level;

/// "75 % · RPE 5".
String effortLabel(num pct) => '${pct.round()} % · RPE ${rpeFor(pct)}';

/// Rangos para la ayuda: "50–57 %" → RPE 2 … "más de 100 %" → RPE 10.
List<({String range, int rpe})> rpeTable({int minPct = 50}) {
  var from = minPct;
  return [
    for (final b in rpeBands)
      () {
        final range = b.maxPct >= 1000 ? 'más de ${from - 1} %' : '$from–${b.maxPct} %';
        from = b.maxPct + 1;
        return (range: range, rpe: b.rpe);
      }(),
  ];
}

/// Test de la Calculadora (distancia y tiempo).
typedef PaceTest = ({num meters, num seconds});

/// Ritmo (segundos por km) para un porcentaje de la velocidad del test.
double paceForPct(PaceTest test, num pct) {
  if (test.meters <= 0 || test.seconds <= 0 || pct <= 0) throw ArgumentError('Datos inválidos');
  return (test.seconds / test.meters * 1000) / (pct / 100);
}

/// Explicación breve del RPE (igual que en la web).
const rpeHelpText =
    'El RPE es el esfuerzo que sentís, de 1 (muy fácil, podés charlar sin problema) a 10 (el máximo, no podés hablar). '
    'Si hace calor, hay viento o subidas, guiate por el RPE más que por el ritmo.';
