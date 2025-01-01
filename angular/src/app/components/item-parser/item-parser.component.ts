import {Component, inject, Input} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ApiService} from '../../services/api.service';
import {cleanObject, max, setDeepProp} from '../../../utils/utils';
import {ParsedItem} from '../../_types/ParsedItem';
import {FormArray, FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {ItemParserService} from '../../services/item-parser.service';
import {JsonDataService} from '../../services/json-data.service';
import {map} from 'rxjs';

@Component({
  selector: 'app-item-parser',
  templateUrl: './item-parser.component.html',
  styleUrl: './item-parser.component.scss',
  standalone: false
})
export class ItemParserComponent {
  @Input() set item(value: any) {
    if (!value) return;
    this.handleItem(value);
  };
  itemCategories!: {id: string, text: string}[];
  parsedItem!: ParsedItem;
  payload: any = {
    query: {
      filters: {},
      stats: []
    }
  };
  bulkPayload: any = {};
  mainForm!: FormGroup
  currencyControl!: FormControl;
  forceChangedCurrency: boolean = false;

  private apiService: ApiService = inject(ApiService);
  private itemParserService: ItemParserService = inject(ItemParserService);
  private jsonDataService: JsonDataService = inject(JsonDataService);
  private fb: FormBuilder = inject(FormBuilder);

  public isLoaded$ = this.itemParserService.isLoaded$;

  protected readonly window = window;
  protected readonly Object = Object;
  protected readonly max = max;

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
    });
    this.currencyControl = this.fb.control('exalted');
    this.apiService.itemFromClipboard$.pipe(takeUntilDestroyed()).subscribe(item => this.handleItem(item));
    this.jsonDataService.loadJsonData()
      .pipe(
        map(data => data.filters.find((f: any) => f.id === 'type_filters')!.filters.find((f: any) => f.id === 'category').option.options),
        takeUntilDestroyed()
      )
      .subscribe(data => {
        this.itemCategories = data;
      });
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

  public get allowSwitchType(): boolean {
    return !(this.parsedItem.class?.includes('map') || this.parsedItem.class?.includes('currency') || this.parsedItem.class?.includes('gem') || this.parsedItem.rarity === 'Unique');
  }

  getOwnGroup(control: 'armour' | 'energyShield' | 'evasion' | 'pDps' | 'eDps' | 'dps'): FormGroup {
    return this.mainForm.get(control) as FormGroup;
  }

  addPropGroup(data: {id: string, min: number, value: boolean}) {
    this.propsGroups.push(this.newPropGroup);
    this.propsGroups.at(-1).patchValue(data);
  }

  handleItem(itemText: string) {
    this.resetForm();
    this.resetPayload();
    this.forceChangedCurrency = false;
    this.parsedItem = {};
    this.parsedItem = this.itemParserService.parseItem(itemText);

    this.parsedItem.props?.forEach(prop => {
      this.addPropGroup({id: prop.id, value: false, min: prop.value as number});
    });

    if (this.parsedItem.class?.includes('currency')) {
      if (this.parsedItem.type === 'Divine Orb' && !this.forceChangedCurrency) {
        this.currencyControl.patchValue('exalted');
      } else if (this.parsedItem.type === 'Exalted Orb' && !this.forceChangedCurrency) {
        this.currencyControl.patchValue('divine');
      }
    }

    this.fillForm(this.parsedItem);
  }

  changeCorruption() {
    this.mainForm.get('corrupted')?.patchValue(!this.mainForm.get('corrupted')?.value)
  }

  switchType() {
    if (!this.mainForm.get('type')) return;
    const prevValue = this.mainForm.get('type')?.value['value'];
    this.mainForm.get('type')?.patchValue({text: this.parsedItem.type, value: !prevValue });
  }

  generatePayload(skipBulk = false) {
    this.resetPayload();
    if (this.mainForm.value.category.includes('currency') && !skipBulk) {
      this.generateBulkPayload();
      return;
    }
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
    setDeepProp(this.payload, this.currencyControl.value, 'query', 'filters', 'trade_filters', 'filters', 'price', 'option');

    if (window.debug) {
      console.log(cleanObject(this.payload, true))
    }
    this.apiService.searchItem(cleanObject(this.payload, true)).then();
  }

  generateBulkPayload() {
    if (!this.parsedItem.type) return;
    const currencyId = this.itemParserService.searchCurrencyId(this.parsedItem.type!);
    if (!currencyId) {
      this.generatePayload(true);
      return;
    }
    setDeepProp(this.bulkPayload, currencyId, 'query', 'want', 0);
    setDeepProp(this.bulkPayload, this.currencyControl.value, 'query', 'have', 0);

    if (window.debug) {
      console.log(cleanObject(this.bulkPayload, true))
    }
    this.apiService.searchBulk(cleanObject(this.bulkPayload, true)).then();
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

  private resetPayload(): void {
    this.payload = {
      query: {
        filters: {
          trade_filters: {
            filters: {
              collapse: {
                option: 'true'
              },
              price: {
                option: 'exalted'
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
    this.bulkPayload = {
      query: {
        status: { option: "online" },
        have: ['exalted']
      },
      sort: { have: "asc" },
      engine: 'new'
    };
  }

  private fillForm(parsedItem: ParsedItem) {
    this.mainForm.get('category')!.patchValue(parsedItem.class);
    this.mainForm.get('rarity')!.patchValue(parsedItem.rarity !== 'Currency' ? parsedItem.rarity?.toLowerCase() : undefined);
    this.mainForm.get('name')!.patchValue(parsedItem.rarity === 'Unique' ? parsedItem.name : undefined);
    this.mainForm.get('type')!.patchValue(!parsedItem.class?.includes('map') ? {text: parsedItem.type, value: (parsedItem.class?.includes('currency') || parsedItem.class?.includes('gem') || parsedItem.rarity === 'Unique')} : {text: null, value: false});
    this.mainForm.get('iLvl')!.patchValue(parsedItem.iLvl);
    this.mainForm.get('corrupted')!.patchValue(parsedItem.corrupted);
    this.getOwnGroup('armour').patchValue({min: parsedItem.armour, value: false });
    this.getOwnGroup('energyShield').patchValue({min: parsedItem.energyShield, value: false });
    this.getOwnGroup('evasion').patchValue({min: parsedItem.evasion, value: false });
    this.getOwnGroup('pDps').patchValue({ min: parsedItem.pDps, value: false });
    this.getOwnGroup('eDps').patchValue({ min: parsedItem.eDps, value: false });
    this.getOwnGroup('dps').patchValue({min: parsedItem.dps, value: false });
  }
}
