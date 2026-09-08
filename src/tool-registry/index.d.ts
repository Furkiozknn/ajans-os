/**
 * Tool Registry — arac tanimlarinin kaynagi.
 *
 * Blueprint §2.4: **yeni arac sozlesmesi yazilmaz**, MCP'nin JSON Schema'si
 * oldugu gibi kullanilir (I1 D6, 7/7 proje). Izin karari arac adina degil,
 * `IzinSinifi`na baglanir — arac adi kirilgan anahtardir.
 */

import type { AracTanimi, IzinSinifi, KebabId } from "../tipler";

export interface AracKaydi {
  tanim: AracTanimi;
  /** Bu aracin hangi izin sinifina girdigi. Ad'dan turetilmez, kayitta yazar. */
  operation: IzinSinifi;
  /** Geri alinamaz mi (silme, yayinlama). Izin kararinin girdisi. */
  irreversible: boolean;
  /** Araci saglayan MCP sunucusu veya yerlesik saglayici. */
  kaynak: string;
}

export interface ToolRegistry {
  /** Arac kaydini adiyla getirir. Yoksa null. */
  getir(arac_adi: string): Promise<AracKaydi | null>;

  /** Bir ajanin sozlesmesindeki araclarin cozulmus hali. */
  listele(agent_id?: KebabId): Promise<AracKaydi[]>;

  /** Cagri argumanlarini aracin inputSchema'sina gore dogrular. */
  argumanlari_dogrula(arac_adi: string, argumanlar: unknown): { gecerli: boolean; hatalar: string[] };
}
