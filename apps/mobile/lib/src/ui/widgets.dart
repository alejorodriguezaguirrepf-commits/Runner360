import 'package:flutter/material.dart';

import '../theme.dart';

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.title, required this.child, this.dark = false, this.trailing});
  final String title;
  final Widget child;
  final bool dark;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final color = dark ? context.colors.navInk : context.colors.ink;
    return Card(
      color: dark ? context.colors.nav : context.colors.surface,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text(title, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: dark ? Brand.lime : color))),
              ?trailing,
            ]),
            const SizedBox(height: 12),
            DefaultTextStyle.merge(style: TextStyle(color: color), child: child),
          ],
        ),
      ),
    );
  }
}

class DemoBadge extends StatelessWidget {
  const DemoBadge({super.key});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        decoration: BoxDecoration(color: context.colors.warningBg, borderRadius: BorderRadius.circular(99)),
        child: Text('DEMO / NO VALIDADO', style: TextStyle(color: context.colors.warning, fontSize: 12, fontWeight: FontWeight.w700)),
      );
}

class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: context.colors.surface2, borderRadius: BorderRadius.circular(12)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 12, color: context.colors.muted)),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: context.colors.ink)),
        ]),
      );
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.error_outline, color: context.colors.danger, size: 40),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Reintentar')),
          ]),
        ),
      );
}
