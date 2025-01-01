import {inject, Injectable} from '@angular/core';
import {ItemProperty, ModType} from '../_types/general';
import {BehaviorSubject, Observable} from 'rxjs';
import {ParsedItem} from '../_types/ParsedItem';
import * as fuzz from 'fuzzball';
import {JsonDataService} from './json-data.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {safeSum} from '../../utils/utils';

@Injectable({
  providedIn: 'root'
})
export class ItemParserService {
  jsonData: any = {};
  allMods: any = {};
  allCurrency: any = {};
  private itemCategories!: {id: string, text: string}[];

  private readonly _isLoaded$ = new BehaviorSubject<boolean>(false);
  private jsonService: JsonDataService = inject(JsonDataService);

  constructor() {
    this.jsonService.loadJsonData().pipe(takeUntilDestroyed()).subscribe(data => {
      this.jsonData = data;
      this.itemCategories = this.jsonData.filters.find((f: any) => f.id === 'type_filters')!.filters.find((f: any) => f.id === 'category').option.options;
      this.allMods = data.stats.flatMap((item: any) => item.entries);
      this.allCurrency = data.data.flatMap((item: any) => item.entries);
    });
  }

  public get isLoaded$(): Observable<boolean> {
    return this._isLoaded$.asObservable();
  }

  public setIsLoadedStatus(value: boolean): void {
    this._isLoaded$.next(value);
  }

  parseItem(itemText: string): ParsedItem {
    let parsedItem: ParsedItem = {};
    const lines = itemText.split('\n').map(line => line.trim());
    const classLine = lines.find(line => line.startsWith('Item Class:'));
    if (!classLine) {
      return {};
    }
    this.setIsLoadedStatus(true);
    const rarityLine = lines.findIndex(line => line.startsWith('Rarity:'));
    const properties: ItemProperty[] = [];
    const blocks = itemText.split('--------').map(block => block.trim());
    parsedItem.class = this.getItemCLass(classLine);
    if (rarityLine !== -1) {
      parsedItem.rarity = lines[rarityLine].split(': ')[1];

      if (!lines[rarityLine + 2]?.includes('----')) {
        parsedItem.name = lines[rarityLine + 1];
        parsedItem.type = lines[rarityLine + 2];
      } else {
        parsedItem.type = lines[rarityLine + 1];
      }
    }

    if (parsedItem.class.includes('map') || parsedItem.class.includes('currency') || parsedItem.class.includes('gem')) {
      this.setIsLoadedStatus(true);
      return parsedItem;
    }

    blocks.forEach(block => {
      const lines = block.split('\n').map(line => line.trim());
      const levelLine = lines.findIndex(line => line.startsWith('Item Level:'));
      const armourLine = lines.findIndex(line => line.startsWith('Armour:') || line.startsWith('[Armour]:'));
      const shieldLine = lines.findIndex(line => line.startsWith('Energy Shield:') || line.startsWith('[EnergyShield|Energy Shield]:'));
      const evasionLine = lines.findIndex(line => line.startsWith('Evasion Rating:') || line.startsWith('[Evasion|Evasion Rating]:'));
      const pDmgLine = lines.findIndex(line => line.startsWith('Physical Damage:'));
      const eDmgLine = lines.findIndex(line => line.startsWith('Elemental Damage:') || line.startsWith('Lightning Damage:') || line.startsWith('Fire Damage:') || line.startsWith('Cold Damage:'));
      const critLine = lines.findIndex(line => line.startsWith('Critical Hit Chance:'));
      const apsLine = lines.findIndex(line => line.startsWith('Attacks per Second:'));
      const qLine = lines.findIndex(line => line.startsWith('Quality:'));
      const corruptedLine = lines.findIndex(line => line.startsWith('Corrupted'));

      if (levelLine !== -1) {
        parsedItem.iLvl = parseInt(lines[levelLine].split(': ')[1], 10);
      }

      if (qLine !== -1) {
        parsedItem.quality = parseInt(lines[qLine].split(': ')[1], 10);
      }

      if (armourLine !== -1) {
        parsedItem.armour = parseInt(lines[armourLine].split(': ')[1], 10);
      }

      if (shieldLine !== -1) {
        parsedItem.energyShield = parseInt(lines[shieldLine].split(': ')[1], 10);
      }

      if (evasionLine !== -1) {
        parsedItem.evasion = parseInt(lines[evasionLine].split(': ')[1], 10);
      }

      if (apsLine !== -1) {
        parsedItem.aps = parseFloat(lines[apsLine].split(': ')[1]);
        let pDps, eDps;

        if (pDmgLine !== -1) {
          const rangesPDps = this.parseRanges(lines[pDmgLine].split(': ')[1]);
          if (rangesPDps.length > 0) {
            let totalPDps = 0;

            rangesPDps.forEach(({ start, end }) => {
              const average = (start + end) / 2;
              totalPDps += average * parsedItem.aps!;
            });

            parsedItem.pDps = Math.round(totalPDps);
            pDps = totalPDps
          }
        }

        if (eDmgLine !== -1) {
          const rangesEDps = this.parseRanges(lines[eDmgLine].split(': ')[1]);
          if (rangesEDps.length > 0) {
            let totalEDps = 0;

            rangesEDps.forEach(({ start, end }) => {
              const average = (start + end) / 2;
              totalEDps += average * parsedItem.aps!;
            });

            parsedItem.eDps = Math.round(totalEDps);
            eDps = totalEDps;
          }
        }

        parsedItem.dps = Math.round(safeSum(pDps, eDps));
      }

      if (corruptedLine !== -1) {
        parsedItem.corrupted = true;
      }

      const isModBlock = lines.some(line => this.isStatLine(line) || this.isStatLineFuzzy(line));

      if (
        isModBlock &&
        levelLine === -1 &&
        armourLine === -1 &&
        shieldLine === -1 &&
        evasionLine === -1 &&
        pDmgLine === -1 &&
        eDmgLine === -1 &&
        critLine === -1 &&
        apsLine === -1
      ) {
        lines.forEach(line => {
          if (line.length > 0) {
            if (eDmgLine === -1 && this.isLineEDmg(line)) {
              return;
            }
            const {bestMatch, bestMatchVariant, modType} = this.matchStat(line);
            if (bestMatch) {
              let index = 0;
              const parsedValue = this.extractStatValue(line, bestMatch.text);
              properties.push({
                id: bestMatch.id,
                key: bestMatch.text.replace('#', line.match(/-?\d+(?:\.\d+)?/)?.[0] || ''),
                value: parsedValue,
                originalLine: bestMatchVariant.replace(/#/g, () => (line.match(/-?\d+(?:\.\d+)?/g) || [])[index++] || '') + (modType !== 'explicit' ? ` (${modType})` : ''),
                isImportant: false
              });
            }
          }
        });
      }
    });

    parsedItem.props = properties;
    if (!parsedItem.corrupted) {
      parsedItem.armour = Math.floor(this.calculateQualityValue(parsedItem.armour!, parsedItem.quality || 0));
      parsedItem.energyShield = Math.floor(this.calculateQualityValue(parsedItem.energyShield!, parsedItem.quality || 0));
      parsedItem.evasion = Math.floor(this.calculateQualityValue(parsedItem.evasion!, parsedItem.quality || 0));
      const eDps = parsedItem.eDps;
      const qualityPDps = this.calculateQualityValue(parsedItem.pDps!, parsedItem.quality || 0);
      parsedItem.pDps = Math.round(qualityPDps);
      parsedItem.dps = Math.round(safeSum(qualityPDps, eDps));
    }

    if (window.debug) {
      console.log(parsedItem);
    }

    this.setIsLoadedStatus(true);
    return parsedItem;
  }

  searchCurrencyId(text: string): string {
    return this.allCurrency.find((currency: {id: string, text: string}) => currency.text === text)?.id || null;
  }

  private getItemCLass(line: string): string {
    let iClass = line.split(':')[1]?.trim();
    if (iClass === 'Quarterstaves') {
      iClass = 'weapon.warstaff';
    } else {
      let bestScore = 0;
      let bestMatch: string = iClass;
      for (const category of this.itemCategories) {
        const score = fuzz.ratio(category.text, iClass);
        if (score >= bestScore && score > 50) {
          bestScore = score;
          bestMatch = category.id;
        }
      }
      iClass = bestMatch;
    }

    return iClass;
  }

  private parseRanges(rangeString: string) {
    const rangeMatches = rangeString.match(/\d+\s*-\s*\d+/g); // Match all patterns like "37-71"
    if (!rangeMatches) {
      throw new Error('Invalid range format. Please use "start-end".');
    }

    return rangeMatches.map((range) => {
      const [startStr, endStr] = range.split('-');
      const start = parseInt(startStr.trim(), 10);
      const end = parseInt(endStr.trim(), 10);

      if (isNaN(start) || isNaN(end)) {
        throw new Error('Invalid range format. Please use "start-end".');
      }

      return { start, end };
    });
  }

  private isStatLine(line: string): boolean {
    const patterns = [
      /^[+-]?-?\d+(?:\.\d+)?/,
      /^-?\d+(?:\.\d+)?\s*to\s*-?\d+(?:\.\d+)?/,
      /-?\d+(?:\.\d+)?%/,
      /Adds\s+-?\d+(?:\.\d+)?/,
      /increased|reduced|decreased|gained|affected|while/,
      /^\w+\s+\w+/,
      /-?\d+(?:\.\d+)?\s*to\s+\w+/,
      /\s+by\s+\w+/
    ];
    return patterns.some(pattern => pattern.test(line));
  }

  private isStatLineFuzzy(line: string): boolean {
    return this.allMods.some((stat: any) => {
      const score = fuzz.ratio(stat.text, line);
      return score > 70;
    });
  }

  private isLineEDmg(line: string) {
    return line.toLowerCase().startsWith('add') && (line.toLowerCase().includes('cold damage') || line.toLowerCase().includes('fire damage') || line.toLowerCase().includes('lightning damage'));
  }

  private matchStat(modLine: string): any | null {
    let bestMatch = null;
    let bestMatchVariant = null;
    let bestScore = 0;
    const modType: ModType = this.extractModType(modLine);
    modLine = this.trimMod(modLine);

    for (const stat of this.jsonData.stats.find((stat: any) => stat.id === modType).entries) {
      if (!stat?.text) {
        continue;
      }

      try {
        const variants = [this.expandStatTemplate(stat.text).at(-1) ?? ''];

        for (const variant of variants) {
          const score = fuzz.ratio(variant, modLine);
          if (score >= bestScore && score > 70) { // Поріг точності 70%
            bestScore = score;
            bestMatch = stat;
            bestMatchVariant = variant;
          }
        }
      } catch (error) {
        console.error(`Failed to parse regex for stat: "${stat.text}"`, error);
      }
    }

    return {bestMatch, bestMatchVariant, modType};
  }

  private extractModType(str: string): ModType {
    const regex = /\((explicit|implicit|enchant|rune|sanctum|skill)\)/;
    const match = str.match(regex);
    return match ? (match[1] as ModType) : 'explicit';
  };

  private trimMod(modLine: string): string {
    return modLine.replace(/\((explicit|implicit|enchant|rune|sanctum|skill)\)/, '').trim()
  }

  private expandStatTemplate(template: string): string[] {
    const regex = /\[([^\]]+)\]/g;
    const matches = Array.from(template.matchAll(regex));

    if (matches.length === 0) {
      return [template];
    }

    let variants: string[] = [template];

    matches.forEach(match => {
      const options = match[1].split('|');
      const tempVariants: string[] = [];

      variants.forEach(variant => {
        options.forEach(option => {
          tempVariants.push(variant.replace(match[0], option));
        });
      });

      variants = tempVariants;
    });

    return variants;
  }

  private extractStatValue(line: string, statTemplate: string): any {
    const rangeMatch = line.match(/(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/);
    if (rangeMatch) {
      return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
    }

    const singleValueMatch = line.match(/(-?\d+(?:\.\d+)?)/);
    if (singleValueMatch) {
      return parseFloat(singleValueMatch[1]);
    }

    return line;
  }

  private calculateQualityValue(number: number, quality: number): number {
    if (typeof number !== 'number') return number;
    if (quality > 20) {
      return number;
    }
    const original = number / (1 + (quality / 100));
    return original * 1.2;
  }
}
