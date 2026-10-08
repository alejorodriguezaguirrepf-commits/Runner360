import 'package:flutter/material.dart';

import '../../data/repository.dart';
import '../../domain/format.dart';
import '../../domain/pace.dart';
import '../../domain/workout_input.dart';
import '../widgets.dart';

class RegisterWorkoutScreen extends StatefulWidget {
  const RegisterWorkoutScreen({super.key, required this.repo, required this.onSaved});
  final Repository repo;
  final VoidCallback onSaved;

  @override
  State<RegisterWorkoutScreen> createState() => _RegisterWorkoutScreenState();
}

class _RegisterWorkoutScreenState extends State<RegisterWorkoutScreen> {
  final _km = TextEditingController();
  final _duration = TextEditingController();
  final _rpe = TextEditingController();
  final _comments = TextEditingController();
  WorkoutStatus _status = WorkoutStatus.completed;
  DateTime _date = DateTime.now();
  bool _pain = false;
  bool _saving = false;
  Map<String, String> _errors = const {};
  String? _message;

  @override
  void initState() {
    super.initState();
    _km.addListener(() => setState(() {}));
    _duration.addListener(() => setState(() {}));
  }

  Future<void> _save() async {
    final v = validateWorkout(
      date: _date,
      today: DateTime.now(),
      status: _status,
      distanceKm: _km.text,
      duration: _duration.text,
      rpe: _rpe.text,
      painReported: _pain,
      comments: _comments.text,
    );
    setState(() => _errors = v.errors);
    if (!v.isValid) return;
    setState(() => _saving = true);
    try {
      await widget.repo.saveWorkout(v.input!);
      _km.clear();
      _duration.clear();
      _rpe.clear();
      _comments.clear();
      setState(() => _message = 'Entrenamiento guardado.');
      widget.onSaved();
    } catch (_) {
      setState(() => _message = 'No pudimos guardar el entrenamiento.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final meters = kmInputToMeters(_km.text);
    final seconds = parseDuration(_duration.text);
    final pace = meters != null && seconds != null ? paceSecondsPerKm(meters, seconds) : null;
    final speed = meters != null && seconds != null ? speedKmh(meters, seconds) : null;
    return ListView(padding: const EdgeInsets.all(16), children: [
      const Text('Registrar entrenamiento', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
      const SizedBox(height: 16),
      SegmentedButton<WorkoutStatus>(
        segments: const [
          ButtonSegment(value: WorkoutStatus.completed, label: Text('Completada')),
          ButtonSegment(value: WorkoutStatus.modified, label: Text('Modificada')),
          ButtonSegment(value: WorkoutStatus.skipped, label: Text('No realizada')),
        ],
        selected: {_status},
        onSelectionChanged: (s) => setState(() => _status = s.first),
      ),
      const SizedBox(height: 12),
      ListTile(
        contentPadding: EdgeInsets.zero,
        title: const Text('Fecha'),
        subtitle: Text(formatDateLong(_date)),
        trailing: const Icon(Icons.edit_calendar_outlined),
        onTap: () async {
          final picked = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now());
          if (picked != null) setState(() => _date = picked);
        },
      ),
      if (_errors['workoutDate'] != null) Text(_errors['workoutDate']!, style: const TextStyle(color: Colors.red)),
      if (_status != WorkoutStatus.skipped) ...[
        TextField(controller: _km, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(labelText: 'Distancia (km)', errorText: _errors['distanceKm'])),
        const SizedBox(height: 12),
        TextField(controller: _duration, decoration: InputDecoration(labelText: 'Duración (mm:ss o h:mm:ss)', errorText: _errors['duration'])),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: StatTile(label: 'Ritmo medio', value: pace == null ? '—' : '${formatPace(pace)} /km')),
          const SizedBox(width: 12),
          Expanded(child: StatTile(label: 'Velocidad', value: speed == null ? '—' : '${speed.toStringAsFixed(1).replaceAll('.', ',')} km/h')),
        ]),
        const SizedBox(height: 12),
        TextField(controller: _rpe, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: 'RPE (1–10)', errorText: _errors['rpe'])),
      ],
      const SizedBox(height: 12),
      TextField(controller: _comments, maxLines: 3, decoration: InputDecoration(labelText: 'Comentarios (opcional)', errorText: _errors['comments'])),
      CheckboxListTile(
        value: _pain,
        onChanged: (v) => setState(() => _pain = v ?? false),
        contentPadding: EdgeInsets.zero,
        controlAffinity: ListTileControlAffinity.leading,
        title: const Text('Tuve dolor o una molestia fuera de lo habitual'),
      ),
      if (_message != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_message!)),
      FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Guardando…' : 'Guardar entrenamiento')),
    ]);
  }
}
