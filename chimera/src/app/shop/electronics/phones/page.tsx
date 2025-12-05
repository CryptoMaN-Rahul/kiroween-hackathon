/**
 * Phones Category Page
 * 
 * Demo page with HIGH fact-density score - lots of structured content.
 * This page demonstrates AI-scannable content patterns.
 */

import Link from 'next/link';

const phones = [
  { 
    name: 'iPhone 15 Pro', 
    brand: 'Apple',
    price: 999, 
    storage: '256GB', 
    battery: '3274mAh', 
    rating: 4.8,
    image: '📱',
    color: 'from-gray-600 to-gray-800',
    features: ['A17 Pro chip', 'Titanium design', 'USB-C', '48MP camera']
  },
  { 
    name: 'Samsung Galaxy S24', 
    brand: 'Samsung',
    price: 899, 
    storage: '256GB', 
    battery: '4000mAh', 
    rating: 4.7,
    image: '📱',
    color: 'from-purple-600 to-purple-800',
    features: ['Snapdragon 8 Gen 3', 'Galaxy AI', 'S Pen support', '200MP camera']
  },
  { 
    name: 'Google Pixel 8', 
    brand: 'Google',
    price: 699, 
    storage: '128GB', 
    battery: '4575mAh', 
    rating: 4.6,
    image: '📱',
    color: 'from-blue-600 to-blue-800',
    features: ['Tensor G3', 'Magic Eraser', '7 years updates', 'Best-in-class AI']
  },
];

function ProductCard({ phone }: { phone: typeof phones[0] }) {
  return (
    <div className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 overflow-hidden hover:border-emerald-500/30 transition-all duration-300 group">
      <div className={`h-48 bg-gradient-to-br ${phone.color} flex items-center justify-center text-7xl`}>
        {phone.image}
      </div>
      <div className="p-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-gray-500 text-sm">{phone.brand}</p>
            <h3 className="text-xl font-bold">{phone.name}</h3>
          </div>
          <div className="flex items-center gap-1 bg-amber-500/20 text-amber-400 px-2 py-1 rounded-lg text-sm">
            ⭐ {phone.rating}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 my-4">
          {phone.features.map((f, i) => (
            <span key={i} className="px-2 py-1 bg-white/5 rounded-lg text-xs text-gray-400">
              {f}
            </span>
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
          <div>
            <span className="text-2xl font-bold text-emerald-400">${phone.price}</span>
            <span className="text-gray-500 text-sm ml-1">USD</span>
          </div>
          <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-sm font-medium transition-colors">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PhonesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center text-xl">
                🧬
              </div>
              <span className="text-xl font-bold">Chimera Shop</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
                Dashboard
              </Link>
              <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors">
                🛒 Cart (0)
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span>Shop</span>
          <span>/</span>
          <span>Electronics</span>
          <span>/</span>
          <span className="text-white">Phones</span>
        </div>

        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            📱 Premium Smartphones
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Browse our selection of flagship smartphones. All devices come with 
            a 2-year warranty and free shipping on orders over $50.
          </p>
        </div>

        {/* Product Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {phones.map((phone) => (
            <ProductCard key={phone.name} phone={phone} />
          ))}
        </div>

        {/* Comparison Table */}
        <div className="bg-gray-800/30 backdrop-blur rounded-2xl border border-gray-700/50 overflow-hidden mb-16">
          <div className="p-6 border-b border-gray-700/50">
            <h2 className="text-2xl font-bold">📊 Quick Comparison</h2>
            <p className="text-gray-500 text-sm">Side-by-side specs for easy decision making</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50 bg-white/5">
                  <th className="p-4 text-left text-gray-400 font-medium">Model</th>
                  <th className="p-4 text-left text-gray-400 font-medium">Price</th>
                  <th className="p-4 text-left text-gray-400 font-medium">Storage</th>
                  <th className="p-4 text-left text-gray-400 font-medium">Battery</th>
                  <th className="p-4 text-left text-gray-400 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {phones.map((phone, i) => (
                  <tr key={phone.name} className={i < phones.length - 1 ? 'border-b border-gray-700/30' : ''}>
                    <td className="p-4 font-medium">{phone.name}</td>
                    <td className="p-4 text-emerald-400 font-bold">${phone.price}</td>
                    <td className="p-4 text-gray-300">{phone.storage}</td>
                    <td className="p-4 text-gray-300">{phone.battery}</td>
                    <td className="p-4">
                      <span className="flex items-center gap-1">
                        <span className="text-amber-400">⭐</span>
                        {phone.rating}/5
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Why Shop With Us */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/10 rounded-2xl p-8 border border-emerald-500/20">
            <h2 className="text-2xl font-bold mb-6">✅ Why Shop With Us</h2>
            <ul className="space-y-4">
              {[
                { stat: '50,000+', text: 'satisfied customers since 2019' },
                { stat: '98%', text: 'customer satisfaction rate' },
                { stat: '2.3 days', text: 'average delivery time' },
                { stat: '30 days', text: 'money-back guarantee' },
                { stat: '5%', text: 'price match - we beat competitors' },
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="text-emerald-400 font-bold text-lg">{item.stat}</span>
                  <span className="text-gray-400">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-blue-900/10 rounded-2xl p-8 border border-blue-500/20">
            <h2 className="text-2xl font-bold mb-6">🚀 Popular Features</h2>
            <ul className="space-y-3">
              {[
                '5G connectivity on all flagship models',
                'OLED displays with 120Hz refresh rate',
                'Advanced AI camera systems',
                'All-day battery life (12+ hours)',
                'Water resistance (IP68 rated)',
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-300">
                  <span className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-xs">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* AI Optimized Badge */}
        <div className="text-center py-8 border-t border-gray-800">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm">
            <span className="w-2 h-2 bg-emerald-400 rounded-full" />
            This page is optimized for AI search engines
          </div>
          <p className="text-gray-600 text-sm mt-2">
            Structured data, high fact-density, proper schema markup
          </p>
        </div>
      </main>

      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Premium Smartphones",
            "description": "Browse our selection of flagship smartphones with 2-year warranty and free shipping",
            "url": "https://chimera-demo.com/shop/electronics/phones",
            "mainEntity": {
              "@type": "ItemList",
              "numberOfItems": 3,
              "itemListElement": phones.map((phone, i) => ({
                "@type": "ListItem",
                "position": i + 1,
                "item": {
                  "@type": "Product",
                  "name": phone.name,
                  "brand": { "@type": "Brand", "name": phone.brand },
                  "offers": {
                    "@type": "Offer",
                    "price": phone.price,
                    "priceCurrency": "USD",
                    "availability": "https://schema.org/InStock"
                  },
                  "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": phone.rating,
                    "bestRating": 5
                  }
                }
              }))
            }
          })
        }}
      />
    </div>
  );
}
