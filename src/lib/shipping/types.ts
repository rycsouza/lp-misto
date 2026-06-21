export interface ShippingAddress {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface ShippingOption {
  id: string;
  name: string;
  company: string;
  priceCents: number;
  deliveryMin: number;
  deliveryMax: number;
}

export interface CartItemForShipping {
  productId: string;
  quantity: number;
  unitPriceCents: number;
}
