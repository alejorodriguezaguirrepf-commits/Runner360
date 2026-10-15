import 'package:flutter/material.dart';

import '../domain/plan_schedule.dart';
import '../theme.dart';

/// Componentes del plan de la biblioteca (mismo diseño que la web: Día N, pasos, valoración).

const categoryLabels = {
  'rest': 'Descanso',
  'rec': 'Recuperación',
  'easy': 'Suave',
  'mod': 'Moderado',
  'thr': 'Umbral',
  'hard': 'Intenso',
  'race': 'Competencia',
};

/// Colores de cada tipo de sesión (texto/fondo ≥ 4,5:1), iguales a la web en cada tema.
(Color, Color) categoryColors(BuildContext context, String? category) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  const light = {
    'rest': (Color(0xFF475569), Color(0xFFEEF2F6)),
    'rec': (Color(0xFF075985), Color(0xFFE0F2FE)),
    'easy': (Color(0xFF166534), Color(0xFFDCFCE7)),
    'mod': (Color(0xFF854D0E), Color(0xFFFEF9C3)),
    'thr': (Color(0xFF9A3412), Color(0xFFFFEDD5)),
    'hard': (Color(0xFF991B1B), Color(0xFFFEE2E2)),
    'race': (Color(0xFF5B21B6), Color(0xFFEDE9FE)),
  };
  const darkMap = {
    'rest': (Color(0xFFC6D3E2), Color(0xFF2B3D52)),
    'rec': (Color(0xFFA5DCFF), Color(0xFF0D3354)),
    'easy': (Color(0xFFA7F3C0), Color(0xFF11402A)),
    'mod': (Color(0xFFFDE68A), Color(0xFF3D3210)),
    'thr': (Color(0xFFFDBA8C), Color(0xFF46260F)),
    'hard': (Color(0xFFFCA5A5), Color(0xFF4A1A1F)),
    'race': (Color(0xFFD8C8FF), Color(0xFF33225A)),
  };
  return (dark ? darkMap : light)[category ?? 'rest'] ?? (dark ? darkMap : light)['rest']!;
}

class Chip2 extends StatelessWidget {
  const Chip2({super.key, required this.text, required this.fg, required this.bg, this.border, this.icon});
  final String text;
  final IconData? icon;
  final Color fg;
  final Color bg;
  final Color? border;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(6),
      border: border == null ? null : Border.all(color: border!),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[Icon(icon, size: 14, color: fg), const SizedBox(width: 2)],
        Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
      ],
    ),
  );
}

const ratingEmoji = {1: '😣', 2: '🙁', 3: '😐', 4: '🙂', 5: '🤩'};
const ratingLabels = {1: 'Muy mal', 2: 'Mal', 3: 'Normal', 4: 'Bien', 5: 'Excelente'};

/// Tira de semanas desplazable: la elegida en lima, la actual con un punto, las bloqueadas con candado.
class WeekStrip extends StatelessWidget {
  const WeekStrip({super.key, required this.weeks, required this.selected, required this.current, required this.isLocked, required this.onSelect});
  final List<ScheduledWeek> weeks;
  final String selected;
  final String current;
  final bool Function(ScheduledWeek) isLocked;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: weeks.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final w = weeks[i];
          final sel = w.weekStart == selected;
          final locked = isLocked(w);
          final label = w.planWeek == null ? 'Pausa' : '${w.planWeek}';
          return Semantics(
            selected: sel,
            label: w.planWeek == null
                ? 'Semana en pausa'
                : 'Semana ${w.planWeek}${locked ? ', se libera con la suscripción' : ''}${w.weekStart == current ? ', semana actual' : ''}',
            button: true,
            excludeSemantics: true,
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => onSelect(w.weekStart),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    constraints: const BoxConstraints(minWidth: 48),
                    height: 48,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: sel ? Brand.lime : (locked ? c.surface2 : c.surface),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: sel ? c.primaryInk : c.line),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (locked) ...[Icon(Icons.lock_outline, size: 14, color: sel ? Brand.night : c.muted), const SizedBox(width: 4)],
                        Text(
                          label,
                          style: TextStyle(fontWeight: FontWeight.w800, color: sel ? Brand.night : (locked ? c.muted : c.ink)),
                        ),
                      ],
                    ),
                  ),
                  if (w.weekStart == current && !sel)
                    Positioned(
                      top: -3,
                      right: 6,
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: Brand.teal,
                          shape: BoxShape.circle,
                          border: Border.all(color: c.surface, width: 2),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Un entrenamiento del plan: "Día N", qué hacer y los pasos; con "¿Cómo te fue?" si ya ocurrió.
class WorkoutCard extends StatefulWidget {
  const WorkoutCard({
    super.key,
    required this.day,
    required this.n,
    required this.date,
    required this.today,
    this.done = false,
    this.rating,
    this.note,
    this.initiallyExpanded = false,
    this.onRate,
  });
  final Map<String, dynamic> day;
  final int n;
  final String date;
  final bool today;
  final bool done;
  final int? rating;
  final String? note;
  final bool initiallyExpanded;

  /// Guarda la valoración; null = no se puede valorar (día futuro).
  final Future<void> Function(int rating, String? note)? onRate;

  @override
  State<WorkoutCard> createState() => _WorkoutCardState();
}

class _WorkoutCardState extends State<WorkoutCard> {
  late bool _open = widget.initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final d = widget.day;
    final (catFg, catBg) = categoryColors(context, d['category'] as String?);
    final steps = <(String, String)>[
      ('CALENTAMIENTO', d['warmup'] as String? ?? '—'),
      ('PRINCIPAL', d['main_set'] as String? ?? '—'),
      ('VUELTA A LA CALMA', d['cooldown'] as String? ?? '—'),
      if (d['strength_after'] == true) ('DESPUÉS', 'Rutina de fuerza'),
    ];
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: widget.today ? Brand.teal : c.line, width: widget.today ? 2 : 1),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _open = !_open),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(color: widget.today ? Brand.lime : c.surface2, borderRadius: BorderRadius.circular(16)),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'DÍA',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: widget.today ? Brand.night : c.muted, height: 1),
                        ),
                        Text(
                          '${widget.n}',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: widget.today ? Brand.night : c.ink, height: 1.1),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          d['session_type'] as String? ?? '',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.ink),
                        ),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              formatPlanMinutes(d['duration_min_est'] as num?),
                              style: TextStyle(fontWeight: FontWeight.w700, color: c.ink),
                            ),
                            if (d['distance_km_est'] != null) Text('· ${formatKm1(d['distance_km_est'] as num)}', style: TextStyle(color: c.muted)),
                            Chip2(text: categoryLabels[d['category']] ?? '', fg: catFg, bg: catBg),
                            if (widget.done) Chip2(text: 'Hecho', icon: Icons.check, fg: c.success, bg: c.successBg),
                            if (widget.rating != null)
                              Chip2(text: '${ratingEmoji[widget.rating]} ${ratingLabels[widget.rating]}', fg: c.ink, bg: c.surface2, border: c.line),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(widget.today ? 'Hoy · ${shortDate(widget.date)}' : shortDate(widget.date), style: TextStyle(fontSize: 12, color: c.muted)),
                      ],
                    ),
                  ),
                  Icon(_open ? Icons.expand_less : Icons.expand_more, color: c.muted),
                ],
              ),
            ),
          ),
          if (_open)
            Container(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: c.line)),
              ),
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < steps.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            margin: const EdgeInsets.only(top: 2, right: 10),
                            width: 14,
                            height: 14,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: i == 1 ? Brand.teal : c.surface,
                              border: Border.all(color: Brand.teal, width: 2),
                            ),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  steps[i].$1,
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.muted, letterSpacing: 0.6),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  steps[i].$2,
                                  style: TextStyle(fontSize: i == 1 ? 16 : 14, fontWeight: i == 1 ? FontWeight.w700 : FontWeight.w400, color: c.ink),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (d['intensity'] != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(12)),
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: 'Intensidad: ',
                              style: TextStyle(fontWeight: FontWeight.w700, color: c.muted),
                            ),
                            TextSpan(
                              text: d['intensity'] as String,
                              style: TextStyle(color: c.ink),
                            ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 12),
                  if (widget.onRate != null)
                    RatingForm(initialRating: widget.rating, initialNote: widget.note, onSave: widget.onRate!)
                  else
                    Text('Vas a poder valorarlo el día del entrenamiento.', style: TextStyle(fontSize: 12, color: c.muted)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// "¿Cómo te fue?": cinco opciones (carita + texto) y una nota opcional.
class RatingForm extends StatefulWidget {
  const RatingForm({super.key, required this.initialRating, required this.initialNote, required this.onSave});
  final int? initialRating;
  final String? initialNote;
  final Future<void> Function(int rating, String? note) onSave;

  @override
  State<RatingForm> createState() => _RatingFormState();
}

class _RatingFormState extends State<RatingForm> {
  late int? _value = widget.initialRating;
  late final _note = TextEditingController(text: widget.initialNote ?? '');
  bool _saving = false;
  String? _message;
  bool _ok = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_value == null) {
      setState(() {
        _ok = false;
        _message = 'Elegí cómo te fue.';
      });
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.onSave(_value!, _note.text);
      setState(() {
        _ok = true;
        _message = 'Valoración guardada.';
      });
    } catch (_) {
      setState(() {
        _ok = false;
        _message = 'No pudimos guardar la valoración. Probá nuevamente.';
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '¿Cómo te fue?',
            style: TextStyle(fontWeight: FontWeight.w700, color: c.ink),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              for (final v in [1, 2, 3, 4, 5])
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(right: v == 5 ? 0 : 6),
                    child: Semantics(
                      button: true,
                      selected: _value == v,
                      label: ratingLabels[v],
                      excludeSemantics: true,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () => setState(() => _value = v),
                        child: Container(
                          height: 64,
                          decoration: BoxDecoration(
                            color: _value == v ? Brand.lime : c.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: _value == v ? c.primaryInk : c.line),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(ratingEmoji[v]!, style: const TextStyle(fontSize: 20)),
                              Text(
                                ratingLabels[v]!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _value == v ? Brand.night : c.ink),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _note,
            maxLength: 500,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Nota (opcional)', hintText: 'Cómo te sentiste, qué cambiarías…', counterText: ''),
          ),
          if (_message != null) ...[
            const SizedBox(height: 8),
            Text(
              _message!,
              style: TextStyle(color: _ok ? c.success : c.danger, fontWeight: FontWeight.w600),
            ),
          ],
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Guardando…' : (widget.initialRating == null ? 'Guardar valoración' : 'Actualizar valoración')),
          ),
        ],
      ),
    );
  }
}
