/// Capa de compras dentro de la app (App Store / Google Play).
///
/// Estado: PENDIENTE. Requiere cuentas de desarrollador, productos de suscripción creados en cada tienda
/// y el endpoint de verificación del servidor (/api/iap/verify). El acceso Premium se otorga SOLO cuando el
/// servidor valida el recibo; la app nunca se concede Premium a sí misma.
abstract class IapGateway {
  bool get isAvailable;
  Future<List<IapProduct>> loadProducts();
  Future<IapPurchaseResult> purchase(String productId);
  Future<void> restore();
}

class IapProduct {
  const IapProduct({required this.id, required this.title, required this.priceLabel});
  final String id;
  final String title;
  final String priceLabel;
}

sealed class IapPurchaseResult {}

class IapPending extends IapPurchaseResult {}

class IapNotConfigured extends IapPurchaseResult {
  final String message = 'Las compras dentro de la app están pendientes de configuración.';
}

/// Implementación por defecto hasta integrar `in_app_purchase` con verificación en servidor.
class PendingIapGateway implements IapGateway {
  @override
  bool get isAvailable => false;
  @override
  Future<List<IapProduct>> loadProducts() async => const [];
  @override
  Future<IapPurchaseResult> purchase(String productId) async => IapNotConfigured();
  @override
  Future<void> restore() async {}
}
