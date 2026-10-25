/// Partes de una sesión (entrada en calor, parte principal, vuelta a la calma) en líneas
/// estructuradas. Port de `packages/plan-library/src/session-blocks.ts`.
///
/// Gramática del contenido desde la versión 2026.12:
///   [TOTAL km: ]tramo + tramo + …
///   tramo = qué[ al P %][ (aclaración)][, pausa … | , nota]
/// Un texto de una versión anterior (sin porcentajes) queda como una sola línea sin intensidad.
library;

class SessionLine {
  const SessionLine({required this.what, this.pct, this.recovery, this.note});

  /// Distancia, repeticiones o tiempo: "6 × 800 m", "11 km", "15 min de movilidad".
  final String what;

  /// Porcentaje de la velocidad del test, o null (movilidad, estiramientos o texto anterior).
  final int? pct;

  /// "Pausa 2 min trotando", "Vuelta caminando al punto de partida".
  final String? recovery;

  /// Aclaración: "Sin pausas".
  final String? note;

  @override
  bool operator ==(Object other) => other is SessionLine && other.what == what && other.pct == pct && other.recovery == recovery && other.note == note;

  @override
  int get hashCode => Object.hash(what, pct, recovery, note);

  @override
  String toString() => 'SessionLine($what, $pct, $recovery, $note)';
}

enum BlockKind { warmup, main, cooldown }

const blockNames = {BlockKind.warmup: 'Entrada en calor', BlockKind.main: 'Parte principal', BlockKind.cooldown: 'Vuelta a la calma'};

class SessionBlock {
  const SessionBlock({required this.kind, required this.lines, this.total, this.maxPct, this.colorPct});
  final BlockKind kind;

  /// Total de la parte principal cuando tiene varios tramos ("15,5 km").
  final String? total;
  final List<SessionLine> lines;

  /// Porcentaje más alto del bloque.
  final int? maxPct;

  /// Porcentaje que define el color: en la parte principal el más alto; en la entrada en calor y la
  /// vuelta a la calma, el del primer tramo.
  final int? colorPct;
}

String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
final _recovery = RegExp(r'^(pausa|vuelta|recuperaci)', caseSensitive: false);
final _withPct = RegExp(r'^(.+?) al (\d{2,3}) %(?: \(([^)]*)\))?(?:, (.+))?$');
final _plain = RegExp(r'^([^,(]+?)(?: \(([^)]*)\))?(?:, (.+))?$');

/// Un tramo: "qué al P % (aclaración), pausa …".
SessionLine parseSegment(String raw) {
  final s = raw.trim();
  final m = _withPct.firstMatch(s);
  final p = m == null ? _plain.firstMatch(s) : null;
  if (m == null && p == null) return SessionLine(what: _cap(s));
  final what = m != null ? m.group(1)! : p!.group(1)!;
  final extras = m != null ? [m.group(3), m.group(4)] : [p!.group(2), p.group(3)];
  String? recovery;
  String? note;
  for (final extra in extras) {
    if (extra == null || extra.isEmpty) continue;
    if (_recovery.hasMatch(extra)) {
      recovery = _cap(extra);
    } else {
      note = note == null ? _cap(extra) : '$note. ${_cap(extra)}';
    }
  }
  return SessionLine(what: _cap(what), pct: m == null ? null : int.parse(m.group(2)!), recovery: recovery, note: note);
}

/// Un bloque de la sesión. Sin porcentajes (contenido anterior): una sola línea con el texto.
SessionBlock parseBlock(String? text, BlockKind kind) {
  final t = (text ?? '').trim();
  if (t.isEmpty) return SessionBlock(kind: kind, lines: const []);
  if (!RegExp(r'\bal \d{2,3} %').hasMatch(t)) return SessionBlock(kind: kind, lines: [SessionLine(what: t)]);
  final header = RegExp(r'^(\d+(?:,\d+)? km): (.+)$').firstMatch(t);
  final body = header != null ? header.group(2)! : t;
  final lines = body.split(' + ').map(parseSegment).toList();
  final pcts = [
    for (final l in lines)
      if (l.pct != null) l.pct!,
  ];
  final maxPct = pcts.isEmpty ? null : pcts.reduce((a, b) => a > b ? a : b);
  return SessionBlock(
    kind: kind,
    total: header?.group(1),
    lines: lines,
    maxPct: maxPct,
    colorPct: kind == BlockKind.main ? maxPct : (pcts.isEmpty ? null : pcts.first),
  );
}

/// Los tres bloques de una sesión.
List<SessionBlock> sessionBlocks(Map<String, dynamic> day) => [
  parseBlock(day['warmup'] as String?, BlockKind.warmup),
  parseBlock(day['main_set'] as String?, BlockKind.main),
  parseBlock(day['cooldown'] as String?, BlockKind.cooldown),
];

/// Porcentaje más alto de la parte principal (para "90 % · RPE 8"), o null.
int? mainPct(Map<String, dynamic> day) => parseBlock(day['main_set'] as String?, BlockKind.main).maxPct;
