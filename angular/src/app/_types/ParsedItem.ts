import {ItemProperty} from './general';

export interface ParsedItem {
  class?: string;
  rarity?: string;
  name?: string;
  type?: string;
  corrupted?: boolean;
  iLvl?: number;
  props?: ItemProperty[];
  armour?: number;
  energyShield?: number;
  evasion?: number;
  quality?: number;
  aps?: number;
  pDps?: number;
  eDps?: number;
  dps?: number;


  [key: string]: any;
}
