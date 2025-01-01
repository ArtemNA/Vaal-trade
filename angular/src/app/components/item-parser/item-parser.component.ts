import {Component, inject, Input} from '@angular/core';
import {JsonDataService} from '../../services/json-data.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ItemProperty, ModType} from '../../_types/general';
import * as fuzz from 'fuzzball';
import {ApiService} from '../../services/api.service';
import {cleanObject, setDeepProp} from '../../../utils/utils';
import {ParsedItem} from '../../_types/ParsedItem';
import {FormArray, FormBuilder, FormGroup} from '@angular/forms';
import {BehaviorSubject} from 'rxjs';

@Component({
  selector: 'app-item-parser',
  templateUrl: './item-parser.component.html',
  styleUrl: './item-parser.component.scss',
  standalone: false
})
export class ItemParserComponent {
  @Input() set item(value: any) {
    if (!value) return;
    this.parsedItem = {};
    this.parseItem(value);
  };
  jsonData: any = {};
  allMods: any = {};
  itemCategories!: {id: string, text: string}[];
  parsedItem!: ParsedItem;
  payload: any = {
    query: {
      filters: {},
      stats: []
    }
  };
  mainForm!: FormGroup

  isLoaded$ = new BehaviorSubject<boolean>(false);

  private jsonService: JsonDataService = inject(JsonDataService);
  private apiService: ApiService = inject(ApiService);
  private fb: FormBuilder = inject(FormBuilder);

  constructor() {
    this.mainForm = this.fb.group({
      category: this.fb.control(undefined),
      rarity: this.fb.control(undefined),
      name: this.fb.control(undefined),
      type: this.fb.control({text: undefined, value: false}),
      iLvl: this.fb.control(undefined),
      corrupted: this.fb.control(false),
      armour: this.newPropGroup,
      energyShield: this.newPropGroup,
      evasion: this.newPropGroup,
      pDps: this.newPropGroup,
      eDps: this.newPropGroup,
      dps: this.newPropGroup,
      props: this.fb.array([])
    })
    this.jsonService.loadJsonData().pipe(takeUntilDestroyed()).subscribe(data => {
      this.jsonData = data;
      this.itemCategories = this.jsonData.filters.find((f: any) => f.id === 'type_filters')!.filters.find((f: any) => f.id === 'category').option.options;
      console.log(data)
      this.allMods = data.stats.flatMap((item: any) => item.entries);
    });
    this.apiService.itemFromClipboard$.pipe(takeUntilDestroyed()).subscribe(item => this.handleItemFromClipboard(item));
  }

  private get newPropGroup(): FormGroup {
    return this.fb.group({
      min: this.fb.control(null),
      max: this.fb.control(null),
      id: this.fb.control(null),
      value: this.fb.control(false),
    })
  }

  public get propsGroups(): FormArray {
    return this.mainForm.get('props') as FormArray;
  }

  getOwnGroup(control: 'armour' | 'energyShield' | 'evasion' | 'pDps' | 'eDps' | 'dps'): FormGroup {
    return this.mainForm.get(control) as FormGroup;
  }

  addPropGroup(data: {id: string, min: number, value: boolean}) {
    this.propsGroups.push(this.newPropGroup);
    this.propsGroups.at(-1).patchValue(data);
  }

  handleItemFromClipboard(itemText: string) {
    try {
      console.log('Item from Clipboard:', itemText);
      this.parsedItem = {};
      this.parseItem(itemText);
    } catch (error) {
      console.error('Failed to parse item from clipboard:', error);
    }
  }

  parseItem(itemText: string): void {
    this.resetForm();
    const lines = itemText.split('\n').map(line => line.trim());
    const classLine = lines.find(line => line.startsWith('Item Class:'));
    if (!classLine) {
      return;
    }
    this.resetPayload();
    this.isLoaded$.next(false);
    const properties: ItemProperty[] = [];
    const blocks = itemText.split('--------').map(block => block.trim());
    this.parsedItem.class = this.getItemCLass(classLine);
    this.mainForm.get('category')!.patchValue(this.parsedItem.class);

     blocks.forEach(block => {
      const lines = block.split('\n').map(line => line.trim());
      const rarityLine = lines.findIndex(line => line.startsWith('Rarity:'));
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

      if (rarityLine !== -1) {
        this.parsedItem.rarity = lines[rarityLine].split(': ')[1];
        this.mainForm.get('rarity')!.patchValue(this.parsedItem.rarity !== 'Currency' ? this.parsedItem.rarity.toLowerCase() : null);

        if (lines[rarityLine + 2]) {
          this.parsedItem.name = lines[rarityLine + 1];
          this.parsedItem.type = lines[rarityLine + 2];
        } else {
          this.parsedItem.type = lines[rarityLine + 1];
        }

        this.mainForm.get('name')!.patchValue(this.parsedItem.rarity === 'Unique' ? this.parsedItem.name : null);
        this.mainForm.get('type')!.patchValue(!this.parsedItem.class?.includes('map') ? {text: this.parsedItem.type, value: (this.parsedItem.class === 'currency' || this.parsedItem.rarity === 'Unique')} : {text: null, value: false});
      }

      if (levelLine !== -1) {
        this.parsedItem.iLvl = parseInt(lines[levelLine].split(': ')[1], 10);
        this.mainForm.get('iLvl')!.patchValue(this.parsedItem.iLvl);
      }

      if (qLine !== -1) {
        console.log(qLine);
        this.parsedItem.quality = parseInt(lines[qLine].split(': ')[1], 10);
      }

      if (armourLine !== -1) {
        this.parsedItem.armour = parseInt(lines[armourLine].split(': ')[1], 10);
        this.getOwnGroup('armour').patchValue({min: this.parsedItem.armour, value: false });
      }

      if (shieldLine !== -1) {
        this.parsedItem.energyShield = parseInt(lines[shieldLine].split(': ')[1], 10);
        this.getOwnGroup('energyShield').patchValue({min: this.parsedItem.energyShield, value: false });
      }

      if (evasionLine !== -1) {
        this.parsedItem.evasion = parseInt(lines[evasionLine].split(': ')[1], 10);
        this.getOwnGroup('evasion').patchValue({min: this.parsedItem.evasion, value: false });
      }

      if (apsLine !== -1) {
        this.parsedItem.aps = parseFloat(lines[apsLine].split(': ')[1]);
        let pDps, eDps;

        if (pDmgLine !== -1) {
          const rangesPDps = this.parseRanges(lines[pDmgLine].split(': ')[1]);
                    if (rangesPDps.length > 0) {
            let totalPDps = 0;

            rangesPDps.forEach(({ start, end }) => {
              const average = (start + end) / 2;
              totalPDps += average * this.parsedItem.aps!;
            });

            this.parsedItem.pDps = Math.round(totalPDps);
            pDps = totalPDps
            this.getOwnGroup('pDps').patchValue({ min: this.parsedItem.pDps, value: false });
          }
        }

        if (eDmgLine !== -1) {
          const rangesEDps = this.parseRanges(lines[eDmgLine].split(': ')[1]);
          if (rangesEDps.length > 0) {
            let totalEDps = 0;

            rangesEDps.forEach(({ start, end }) => {
              const average = (start + end) / 2;
              console.log(average)
              totalEDps += average * this.parsedItem.aps!;
            });

            this.parsedItem.eDps = Math.round(totalEDps);
            eDps = totalEDps;
            this.getOwnGroup('eDps').patchValue({ min: this.parsedItem.eDps, value: false });
          }
        }

        this.parsedItem.dps = Math.round(this.safeSum(pDps, eDps));
        this.getOwnGroup('dps').patchValue({min: this.parsedItem.dps, value: false });
      }

      if (corruptedLine !== -1) {
        this.parsedItem.corrupted = true;
        this.mainForm.get('corrupted')!.patchValue(this.parsedItem.corrupted);
      }

      const isModBlock = lines.some(line => this.isStatLine(line) || this.isStatLineFuzzy(line));

      if (
        isModBlock &&
        rarityLine === -1 &&
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
              this.addPropGroup({id: bestMatch.id, value: false, min: parsedValue});
            } else {}
          }
        });
      }
    });

    this.parsedItem.props = properties;
    if (!this.parsedItem.corrupted) {
        this.parsedItem.armour = Math.floor(this.calculateQualityValue(this.parsedItem.armour!, this.parsedItem.quality || 0));
        this.parsedItem.energyShield = Math.floor(this.calculateQualityValue(this.parsedItem.energyShield!, this.parsedItem.quality || 0));
        this.parsedItem.evasion = Math.floor(this.calculateQualityValue(this.parsedItem.evasion!, this.parsedItem.quality || 0));
        const eDps = this.parsedItem.eDps;
        const qualityPDps = this.calculateQualityValue(this.parsedItem.pDps!, this.parsedItem.quality || 0);
        this.parsedItem.pDps = Math.round(qualityPDps);
        this.parsedItem.dps = Math.round(this.safeSum(qualityPDps, eDps));

      this.getOwnGroup('armour').patchValue({min: this.parsedItem.armour, value: false });
      this.getOwnGroup('energyShield').patchValue({min: this.parsedItem.armour, value: false });
      this.getOwnGroup('evasion').patchValue({min: this.parsedItem.armour, value: false });
      this.getOwnGroup('pDps').patchValue({min: this.parsedItem.pDps, value: false });
      this.getOwnGroup('dps').patchValue({min: this.parsedItem.dps, value: false });
    }

    if (window.debug) {
      console.log(this.parsedItem);
    }

    this.isLoaded$.next(true);
  }

  extractStatValue(line: string, statTemplate: string): any {
    const rangeMatch = line.match(/(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/);
    if (rangeMatch) {
      return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
    }

    const singleValueMatch = line.match(/(-?\d+(?:\.\d+)?)/);
    if (singleValueMatch) {
      console.log(singleValueMatch)
      return parseFloat(singleValueMatch[1]);
    }

    return line;
  }


  isStatLine(line: string): boolean {
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

  isStatLineFuzzy(line: string): boolean {
    return this.allMods.some((stat: any) => {
      const score = fuzz.ratio(stat.text, line);
      return score > 70;
    });
  }

  expandStatTemplate(template: string): string[] {
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

  matchStat(modLine: string): any | null {
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

  extractModType(str: string): ModType {
    const regex = /\((explicit|implicit|enchant|rune|sanctum|skill)\)/;
    const match = str.match(regex);
    return match ? (match[1] as ModType) : 'explicit';
  };

  trimMod(modLine: string): string {
    return modLine.replace(/\((explicit|implicit|enchant|rune|sanctum|skill)\)/, '').trim()
  }

  generatePayload() {
    this.resetPayload();
    if (this.mainForm.value.rarity !== 'unique' && this.mainForm.value.rarity !== 'currency') {
      setDeepProp(this.payload, this.mainForm.value.category, 'query', 'filters', 'type_filters', 'filters', 'category', 'option');
      setDeepProp(this.payload, this.mainForm.value.rarity, 'query', 'filters', 'type_filters', 'filters', 'rarity', 'option');
    }
    setDeepProp(this.payload, `${!!this.mainForm.value.corrupted}`, 'query', 'filters', 'misc_filters', 'filters', 'corrupted', 'option');
    setDeepProp(this.payload, this.mainForm.value.name, 'query', 'name');
    if (this.mainForm.value.type.value) {
      setDeepProp(this.payload, this.mainForm.value.type.text, 'query', 'type');
    }
    if (this.mainForm.value.armour.value) {
      setDeepProp(this.payload, { min: this.mainForm.value.armour.min, max: this.mainForm.value.armour.max }, 'query', 'filters', 'equipment_filters', 'filters', 'ar');
    }
    if (this.mainForm.value.evasion.value) {
      setDeepProp(this.payload, { min: this.mainForm.value.evasion.min, max: this.mainForm.value.evasion.max }, 'query', 'filters', 'equipment_filters', 'filters', 'ev');
    }
    if (this.mainForm.value.energyShield.value) {
      setDeepProp(this.payload, { min: this.mainForm.value.energyShield.min, max: this.mainForm.value.energyShield.max }, 'query', 'filters', 'equipment_filters', 'filters', 'es');
    }
    if (this.mainForm.value.pDps.value) {
      setDeepProp(this.payload, { min: this.mainForm.value.pDps.min, max: this.mainForm.value.pDps.max }, 'query', 'filters', 'equipment_filters', 'filters', 'pdps');
    }
    if (this.mainForm.value.eDps.value) {
      setDeepProp(this.payload, { min: this.mainForm.value.eDps.min, max: this.mainForm.value.eDps.max }, 'query', 'filters', 'equipment_filters', 'filters', 'edps');
    }
    if (this.mainForm.value.dps.value) {
      setDeepProp(this.payload, { min: this.mainForm.value.dps.min, max: this.mainForm.value.dps.max }, 'query', 'filters', 'equipment_filters', 'filters', 'dps');
    }
    const props = this.mainForm.value.props.filter((prop: any) => prop.value).map((prop: any) => ({
      id: prop.id,
      min: prop.min || undefined,
      max: prop.max || undefined,
    }))
    setDeepProp(this.payload, props, 'query', 'stats', 0, 'filters');
    if (this.payload.query.stats[0].filters?.length) {
      setDeepProp(this.payload, 'and', 'query', 'stats', 0, 'type')
    } else {
      delete this.payload.query.stats;
    }
    if (this.mainForm.value.type.text === 'Divine Orb') {
      setDeepProp(this.payload, 'exalted', 'query', 'filters', 'trade_filters', 'filters', 'price', 'option');
    } else if (this.mainForm.value.type.text === 'Exalted Orb') {
      setDeepProp(this.payload, 'divine', 'query', 'filters', 'trade_filters', 'filters', 'price', 'option');
    }

    this.apiService.searchItem(cleanObject(this.payload, true)).then();
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

  private calculateQualityValue(number: number, quality: number): number {
    if (typeof number !== 'number') return number;
    if (quality > 20) {
      return number;
    }
    console.log(quality)
    const original = number / (1 + (quality / 100));
    return original * 1.2;
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

  private safeSum(a: number | undefined, b: number | undefined) {
    return (a ?? 0) + (b ?? 0);
  }

  private resetForm(): void {
    this.propsGroups.clear();
    this.mainForm.reset({
      category: undefined,
      rarity: undefined,
      name: undefined,
      type: { text: undefined, value: false },
      iLvl: undefined,
      corrupted: false,
      armour: this.newPropGroup,
      energyShield: this.newPropGroup,
      evasion: this.newPropGroup,
      pDps: this.newPropGroup,
      eDps: this.newPropGroup,
      dps: this.newPropGroup,
      props: []
    });
  }

  public max(num1: number, num2: number): number {
    return Math.max(num1, num2)
  }

  private isLineEDmg(line: string) {
    return line.toLowerCase().startsWith('add') && (line.toLowerCase().includes('cold damage') || line.toLowerCase().includes('fire damage') || line.toLowerCase().includes('lightning damage'));
  }

  private resetPayload(): void {
    this.payload = {
      query: {
        filters: {
          trade_filters: {
            filters: {
              collapse: {
                option: 'true'
              }
            }
          }
        },
        stats: [],
        status: { option: "online" },
        name: null,
        type:  null,
      },
      sort: { price: "asc" }
    };
  }

  protected readonly window = window;
  protected readonly Object = Object;
}
