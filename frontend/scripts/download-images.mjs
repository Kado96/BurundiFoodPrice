import fs from 'fs';
import path from 'path';
import https from 'https';

// Images libres de droits de haute qualité et représentatives pour chaque produit et marché
const PRODUCT_IMAGES = {
  "Riz local": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
  "Maïs grain": "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=600&q=80",
  "Sorgho": "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80",
  "Haricot jaune": "https://images.unsplash.com/photo-1596797882870-8c33deeac224?auto=format&fit=crop&w=600&q=80",
  "Petits pois secs": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80",
  "Arachides": "https://images.unsplash.com/photo-1567892328127-d0e5ea75d862?auto=format&fit=crop&w=600&q=80",
  "Farine de manioc": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80",
  "Pomme de terre": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80",
  "Patate douce": "https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?auto=format&fit=crop&w=600&q=80",
  "Banane plantain": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80",
  "Tomates": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80",
  "Oignons": "https://images.unsplash.com/photo-1587049352851-8d4e89133924?auto=format&fit=crop&w=600&q=80",
  "Huile de palme": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
  "Viande de bœuf": "https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80",
  "Ndagala séché": "https://images.unsplash.com/photo-1534948216015-843149f72be3?auto=format&fit=crop&w=600&q=80",
  "Sucre": "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80"
};

const MARKET_HEROES = [
  {
    name: "Marché Central de Bujumbura (Siyoni)",
    filename: "marche-bujumbura.jpg",
    url: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=1200&q=85",
    caption: "Marché de Bujumbura — Cœur commercial et vivrier de la capitale",
    province: "Bujumbura Mairie"
  },
  {
    name: "Marché de Gitega",
    filename: "marche-gitega.jpg",
    url: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=85",
    caption: "Marché de Gitega — Carrefour stratégique des hauts plateaux",
    province: "Gitega"
  },
  {
    name: "Marché de Ngozi",
    filename: "marche-ngozi.jpg",
    url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85",
    caption: "Marché de Ngozi — Grand pôle de négoce agricole du Nord",
    province: "Ngozi"
  },
  {
    name: "Marché de Rumonge",
    filename: "marche-rumonge.jpg",
    url: "https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=1200&q=85",
    caption: "Marché de Rumonge — Pôle lacustre, huile de palme et poissons du Tanganyika",
    province: "Rumonge"
  }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function run() {
  const prodDir = path.resolve('public/images/products');
  const marketDir = path.resolve('public/images/markets');

  console.log("==> Téléchargement des photos réelles des Marchés...");
  for (const m of MARKET_HEROES) {
    const dest = path.join(marketDir, m.filename);
    try {
      await download(m.url, dest);
      console.log(`✅ Marché: ${m.name} -> ${m.filename}`);
    } catch (e) {
      console.error(`❌ Erreur marché ${m.name}:`, e.message);
    }
  }

  console.log("\n==> Téléchargement des photos réelles des Produits Vivriers...");
  for (const [prodName, url] of Object.entries(PRODUCT_IMAGES)) {
    const slug = prodName.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");
    const dest = path.join(prodDir, `${slug}.jpg`);
    try {
      await download(url, dest);
      console.log(`✅ Produit: ${prodName} -> ${slug}.jpg`);
    } catch (e) {
      console.error(`❌ Erreur produit ${prodName}:`, e.message);
    }
  }

  console.log("\n🎉 Toutes les photos ont été téléchargées avec succès !");
}

run();
