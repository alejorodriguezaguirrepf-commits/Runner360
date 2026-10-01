import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/metrics.dart';
import '../../core/validation.dart';
import '../../data/repository.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, required this.repo, required this.onSaved});
  final Repository repo;
  final VoidCallback onSaved;
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _km = TextEditingController();
  final _duration = TextEditingController();
  final _rpe = TextEditingController();
  final _notes = TextEditingController();
  String _status = 'completed';
  DateTime _startedAt = DateTime.now();
  Map<String, String> _errors = {};
  String? _message;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_km, _duration, _rpe, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  WorkoutInput? _input() {
    final m = _km.text.trim().isEmpty ? 0 : parseKmToMeters(_km.text);
    final s = _duration.text.trim().isEmpty ? 0 : parseDuration(_duration.text);
    final errs = <String, String>{};
    if (m == null) errs['distanceM'] = 'Distancia inválida (ej.: 8,5)';
    if (s == null) errs['durationS'] = 'Duración inválida (45, 45:30 o 1:02:03)';
    final rpe = _rpe.text.trim().isEmpty ? null : int.tryParse(_rpe.text.trim());
    if (_rpe.text.trim().isNotEmpty && rpe == null) errs['rpe'] = 'RPE inválido';
    if (errs.isNotEmpty) {
      setState(() => _errors = errs);
      return null;
    }
    return WorkoutInput(startedAt: _startedAt, distanceM: m!, durationS: s!, status: _status, rpe: rpe, notes: _notes.text.trim().isEmpty ? null : _notes.text.trim());
  }

  Future<void> _save() async {
    final input = _input();
    if (input == null) return;
    final errs = validateWorkout(input);
    setState(() => _errors = errs);
    if (errs.isNotEmpty) return;
    setState(() => _busy = true);
    try {
      await widget.repo.saveWorkout(input);
      setState(() => _message = 'Entrenamiento guardado.');
      widget.onSaved();
    } catch (_) {
      setState(() => _message = 'No pudimos guardar. Intentá nuevamente.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = parseKmToMeters(_km.text) ?? 0;
    final s = parseDuration(_duration.text) ?? 0;
    final speed = speedKmh(m, s);
    return ListView(padding: const EdgeInsets.all(16), children: [
      Text('Registrar entrenamiento', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 12),
      if (_message != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_message!)),
      DropdownButtonFormField<String>(
        initialValue: _status,
        decoration: const InputDecoration(labelText: 'Estado'),
        items: const [
          DropdownMenuItem(value: 'completed', child: Text('Completada')),
          DropdownMenuItem(value: 'modified', child: Text('Modificada')),
          DropdownMenuItem(value: 'skipped', child: Text('No realizada')),
        ],
        onChanged: (v) => setState(() => _status = v ?? 'completed'),
      ),
      const SizedBox(height: 12),
      ListTile(
        contentPadding: EdgeInsets.zero,
        title: const Text('Fecha y hora'),
        subtitle: Text(_startedAt.toString().substring(0, 16)),
        trailing: const Icon(Icons.edit_calendar),
        onTap: () async {
          final d = await showDatePicker(context: context, initialDate: _startedAt, firstDate: DateTime(2020), lastDate: DateTime.now());
          if (d == null || !context.mounted) return;
          final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_startedAt));
          setState(() => _startedAt = DateTime(d.year, d.month, d.day, t?.hour ?? 7, t?.minute ?? 0));
        },
      ),
      if (_status != 'skipped') ...[
        TextField(controller: _km, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(labelText: 'Distancia (km)', errorText: _errors['distanceM']), onChanged: (_) => setState(() {})),
        const SizedBox(height: 12),
        TextField(controller: _duration, decoration: InputDecoration(labelText: 'Duración (min, mm:ss o h:mm:ss)', errorText: _errors['durationS']), onChanged: (_) => setState(() {})),
        const SizedBox(height: 8),
        Text('Ritmo: ${formatPace(paceSecondsPerKm(m, s))} · Velocidad: ${speed == null ? '—' : '${speed.toStringAsFixed(1).replaceAll('.', ',')} km/h'}'),
        const SizedBox(height: 12),
        TextField(controller: _rpe, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: 'RPE (1-10)', errorText: _errors['rpe'])),
      ],
      const SizedBox(height: 12),
      TextField(controller: _notes, maxLines: 3, maxLength: 1000, decoration: const InputDecoration(labelText: 'Comentarios')),
      const SizedBox(height: 12),
      FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Guardando…' : 'Guardar entrenamiento')),
    ]);
  }
}
