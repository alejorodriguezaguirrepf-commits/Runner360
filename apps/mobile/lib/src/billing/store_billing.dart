/// Capa de compras dentro de la app (App Store / Google Play).
///
/// PENDIENTE DE CONFIGURACIÓN. Diseño previsto:
///  1. La app inicia la compra con el plugin oficial (`in_app_purchase`).
///  2. Envía el recibo / purchaseToken a `POST /api/v1/billing/verify` (backend web).
///  3. El backend valida con App Store Server API / Google Play Developer API y recién entonces
///     crea o actualiza la fila en `subscriptions` (provider = apple | google).
/// La app nunca otorga Premium localmente: el estado se lee siempre del backend (`has_premium`).
abstract class StoreBillingService {
  bool get isAvailable;
  Future<List<StoreProduct>> loadProducts();
  Future<void> purchase(String productId);
}

class StoreProduct {
  const StoreProduct({required this.id, required this.title, required this.priceLabel});
  final String id;
  final String title;
  final String priceLabel;
}

/// Implementación por defecto mientras no haya credenciales de tienda.
class UnconfiguredStoreBilling implements StoreBillingService {
  @override
  bool get isAvailable => false;

  @override
  Future<List<StoreProduct>> loadProducts() async => const [];

  @override
  Future<void> purchase(String productId) => throw UnsupportedError('Compras en la app pendientes de configuración');
}
