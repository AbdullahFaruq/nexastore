/**
 * A realistic catalogue for demo stores.
 *
 * Prices are in MAJOR units here for readability and converted to minor units
 * by the generator. `weight` drives how often an item sells, so the demo store
 * has genuine bestsellers and genuine slow movers rather than uniform noise.
 */
export interface CatalogItem {
  name: string;
  sku: string;
  category: string;
  cost: number;
  price: number;
  /** Relative sales frequency. */
  weight: number;
  stock: number;
  minStock: number;
  supplier: string;
  unit?: string;
  discount?: number;
  description?: string;
}

export const ELECTRONICS_CATALOG: CatalogItem[] = [
  // Phones - high value, low volume
  { name: "Pixel 9 Pro 256GB", sku: "PH-PX9P-256", category: "Phones", cost: 640, price: 999, weight: 7, stock: 18, minStock: 6, supplier: "Northgate Distribution", description: "Flagship Android handset with a 6.7-inch display and 256GB storage." },
  { name: "Galaxy S25 128GB", sku: "PH-GS25-128", category: "Phones", cost: 528, price: 849, weight: 8, stock: 24, minStock: 8, supplier: "Northgate Distribution" },
  { name: "iPhone 17 128GB", sku: "PH-IP17-128", category: "Phones", cost: 690, price: 1049, weight: 9, stock: 15, minStock: 6, supplier: "Meridian Supply" },
  { name: "Nord 5 Lite", sku: "PH-ND5L-128", category: "Phones", cost: 198, price: 329, weight: 11, stock: 4, minStock: 12, supplier: "Meridian Supply" },
  { name: "Moto G Play", sku: "PH-MGP-064", category: "Phones", cost: 92, price: 169, weight: 9, stock: 37, minStock: 12, supplier: "Baytree Wholesale" },

  // Audio - the volume driver
  { name: "AirPods Pro 3", sku: "AU-APP3", category: "Audio", cost: 148, price: 249, weight: 34, stock: 9, minStock: 20, supplier: "Meridian Supply", description: "Active noise cancelling earbuds with adaptive transparency." },
  { name: "Sony WH-1000XM6", sku: "AU-SXM6", category: "Audio", cost: 232, price: 379, weight: 16, stock: 21, minStock: 8, supplier: "Northgate Distribution" },
  { name: "Bose QuietComfort Ultra", sku: "AU-BQCU", category: "Audio", cost: 245, price: 399, weight: 11, stock: 12, minStock: 6, supplier: "Northgate Distribution" },
  { name: "JBL Flip 7 Speaker", sku: "AU-JBF7", category: "Audio", cost: 62, price: 119, weight: 24, stock: 0, minStock: 15, supplier: "Baytree Wholesale" },
  { name: "Anker Soundcore Life", sku: "AU-ASCL", category: "Audio", cost: 21, price: 44, weight: 31, stock: 19, minStock: 25, supplier: "Baytree Wholesale" },
  { name: "Marshall Emberton III", sku: "AU-MEM3", category: "Audio", cost: 96, price: 169, weight: 13, stock: 19, minStock: 8, supplier: "Northgate Distribution" },
  { name: "Shure MV7+ Microphone", sku: "AU-SMV7", category: "Audio", cost: 178, price: 279, weight: 5, stock: 8, minStock: 4, supplier: "Meridian Supply" },

  // Computers
  { name: "MacBook Air 15in M4", sku: "CO-MBA15-M4", category: "Computers", cost: 985, price: 1399, weight: 6, stock: 11, minStock: 4, supplier: "Meridian Supply" },
  { name: "ThinkPad X1 Carbon", sku: "CO-TPX1C", category: "Computers", cost: 1120, price: 1649, weight: 3, stock: 6, minStock: 3, supplier: "Northgate Distribution" },
  { name: "iPad Air 11in", sku: "CO-IPA11", category: "Computers", cost: 432, price: 649, weight: 12, stock: 22, minStock: 8, supplier: "Meridian Supply" },
  { name: "Logitech MX Master 4", sku: "CO-LMX4", category: "Computers", cost: 58, price: 109, weight: 26, stock: 12, minStock: 18, supplier: "Baytree Wholesale" },
  { name: "Keychron K8 Pro", sku: "CO-KCK8P", category: "Computers", cost: 71, price: 129, weight: 14, stock: 27, minStock: 10, supplier: "Baytree Wholesale" },
  { name: "Dell 27in 4K Monitor", sku: "CO-DL27-4K", category: "Computers", cost: 268, price: 429, weight: 8, stock: 14, minStock: 5, supplier: "Northgate Distribution" },
  { name: "Samsung T9 SSD 2TB", sku: "CO-SST9-2T", category: "Computers", cost: 142, price: 229, weight: 15, stock: 31, minStock: 10, supplier: "Meridian Supply" },

  // Wearables
  { name: "Apple Watch Series 11", sku: "WE-AWS11", category: "Wearables", cost: 268, price: 429, weight: 13, stock: 17, minStock: 6, supplier: "Meridian Supply" },
  { name: "Garmin Forerunner 275", sku: "WE-GFR275", category: "Wearables", cost: 212, price: 349, weight: 7, stock: 13, minStock: 5, supplier: "Northgate Distribution" },
  { name: "Fitbit Charge 7", sku: "WE-FBC7", category: "Wearables", cost: 78, price: 149, weight: 18, stock: 34, minStock: 12, supplier: "Baytree Wholesale" },
  { name: "Oura Ring Gen 5", sku: "WE-OUR5", category: "Wearables", cost: 195, price: 329, weight: 6, stock: 9, minStock: 4, supplier: "Meridian Supply" },
  { name: "Amazfit Bip 6", sku: "WE-AZB6", category: "Wearables", cost: 34, price: 79, weight: 21, stock: 62, minStock: 20, supplier: "Baytree Wholesale" },

  // Accessories - highest volume, thinnest margin
  { name: "USB-C Cable 2m Braided", sku: "AC-USBC-2M", category: "Accessories", cost: 3.2, price: 12.99, weight: 62, stock: 26, minStock: 60, supplier: "Baytree Wholesale" },
  { name: "65W GaN Charger", sku: "AC-GAN65", category: "Accessories", cost: 14, price: 34.99, weight: 38, stock: 31, minStock: 40, supplier: "Baytree Wholesale" },
  { name: "MagSafe Power Bank 10K", sku: "AC-MSPB10", category: "Accessories", cost: 26, price: 59.99, weight: 27, stock: 71, minStock: 25, supplier: "Meridian Supply" },
  { name: "Tempered Glass Screen Guard", sku: "AC-TGSG", category: "Accessories", cost: 1.8, price: 9.99, weight: 71, stock: 64, minStock: 80, supplier: "Baytree Wholesale" },
  { name: "Leather Phone Case", sku: "AC-LPC", category: "Accessories", cost: 8.5, price: 29.99, weight: 44, stock: 96, minStock: 30, supplier: "Halden Leather Co" },
  { name: "Laptop Sleeve 15in", sku: "AC-LS15", category: "Accessories", cost: 11, price: 32.99, weight: 19, stock: 43, minStock: 15, supplier: "Halden Leather Co" },
  { name: "Adjustable Laptop Stand", sku: "AC-ALS", category: "Accessories", cost: 17, price: 44.99, weight: 16, stock: 38, minStock: 12, supplier: "Baytree Wholesale" },
  { name: "Webcam Cover Pack", sku: "AC-WCP", category: "Accessories", cost: 0.7, price: 5.99, weight: 23, stock: 180, minStock: 50, supplier: "Baytree Wholesale" },
  { name: "Car Vent Phone Mount", sku: "AC-CVPM", category: "Accessories", cost: 4.4, price: 16.99, weight: 25, stock: 88, minStock: 30, supplier: "Baytree Wholesale" },
  { name: "4-Port USB Hub", sku: "AC-U4H", category: "Accessories", cost: 9.2, price: 24.99, weight: 20, stock: 57, minStock: 20, supplier: "Meridian Supply" },
  { name: "Wireless Charging Pad", sku: "AC-WCPD", category: "Accessories", cost: 12, price: 29.99, weight: 22, stock: 64, minStock: 22, supplier: "Baytree Wholesale", discount: 24.99 },
  { name: "Cable Organiser Set", sku: "AC-COS", category: "Accessories", cost: 2.9, price: 11.99, weight: 17, stock: 132, minStock: 40, supplier: "Baytree Wholesale" },

  // Deliberate slow movers, so "dead stock" insights have something to find.
  { name: "Mini Projector HD", sku: "AC-MPHD", category: "Accessories", cost: 88, price: 179, weight: 1, stock: 14, minStock: 4, supplier: "Northgate Distribution" },
  { name: "Retro Bluetooth Radio", sku: "AU-RBR", category: "Audio", cost: 42, price: 89, weight: 1, stock: 22, minStock: 5, supplier: "Baytree Wholesale" },
  { name: "Digital Photo Frame 10in", sku: "AC-DPF10", category: "Accessories", cost: 39, price: 89, weight: 1, stock: 17, minStock: 5, supplier: "Northgate Distribution" },
];

export const CUSTOMER_FIRST = [
  "Amara", "Yusuf", "Elena", "Marcus", "Priya", "Tomas", "Leila", "Jonas", "Nadia", "Rafael",
  "Ingrid", "Omar", "Sofia", "Dmitri", "Chiara", "Kwame", "Anika", "Lars", "Rosa", "Hiroshi",
  "Fatima", "Ewan", "Mira", "Santiago", "Zara", "Niels", "Aisha", "Bruno", "Petra", "Kenji",
  "Lucia", "Idris", "Freya", "Mateo", "Sana", "Viktor", "Noor", "Callum", "Tess", "Emeka",
  "Beatriz", "Arjun", "Helle", "Nico", "Suri", "Gideon", "Marta", "Rune", "Layla", "Oscar",
];

export const CUSTOMER_LAST = [
  "Okafor", "Demir", "Castellanos", "Whitfield", "Raghavan", "Novak", "Haddad", "Lindqvist",
  "Farouk", "Moreira", "Bergstrom", "Nasser", "Duarte", "Volkov", "Rinaldi", "Mensah",
  "Sorensen", "Andersen", "Delgado", "Tanaka", "Bennani", "Fraser", "Kovac", "Herrera",
  "Qureshi", "Jansen", "Diallo", "Ferreira", "Novotny", "Ito", "Salazar", "Abubakar",
  "Holmgren", "Rojas", "Kapoor", "Petrov", "Rahman", "Sinclair", "Vermeer", "Nwosu",
];

export const EXPENSE_TEMPLATES: {
  category: import("@/lib/db/models/enums").ExpenseCategory;
  description: string;
  vendor: string;
  amount: number;
  cadence: "monthly" | "weekly" | "occasional";
  variance?: number;
}[] = [
  { category: "rent", description: "Shop lease - High Street unit", vendor: "Ardent Property", amount: 3200, cadence: "monthly" },
  { category: "salaries", description: "Staff payroll", vendor: "Payroll", amount: 8400, cadence: "monthly", variance: 0.08 },
  { category: "utilities", description: "Electricity and water", vendor: "Municipal Utilities", amount: 410, cadence: "monthly", variance: 0.22 },
  { category: "utilities", description: "Broadband and phone line", vendor: "Fibrelink", amount: 129, cadence: "monthly" },
  { category: "marketing", description: "Local search advertising", vendor: "Search Ads", amount: 640, cadence: "monthly", variance: 0.35 },
  { category: "marketing", description: "Social campaign", vendor: "Social Ads", amount: 320, cadence: "occasional", variance: 0.5 },
  { category: "shipping", description: "Courier account", vendor: "SwiftPost", amount: 285, cadence: "monthly", variance: 0.3 },
  { category: "supplies", description: "Bags, receipt rolls and packaging", vendor: "Baytree Wholesale", amount: 148, cadence: "monthly", variance: 0.25 },
  { category: "maintenance", description: "Card terminal service plan", vendor: "PayTerm", amount: 89, cadence: "monthly" },
  { category: "maintenance", description: "Shopfront repair", vendor: "Hensley Trades", amount: 470, cadence: "occasional", variance: 0.6 },
  { category: "taxes", description: "Business rates instalment", vendor: "Revenue Office", amount: 980, cadence: "monthly" },
  { category: "supplies", description: "Cleaning contract", vendor: "Brightwork", amount: 210, cadence: "monthly" },
  { category: "other", description: "Accounting software", vendor: "Ledgerly", amount: 62, cadence: "monthly" },
  { category: "other", description: "Business insurance", vendor: "Coverfirst", amount: 340, cadence: "monthly" },
];
