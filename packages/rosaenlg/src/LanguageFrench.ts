/**
 * @license
 * Copyright 2019 Ludan Stoecklé
 * SPDX-License-Identifier: Apache-2.0
 */

import { DetParams, DetTypes, LanguageImpl, SomeTense, AgreeAdjParams, GrammarParsed } from './LanguageImpl';
import { GenderNumberManager } from './GenderNumberManager';
import { RefsManager, NextRef } from './RefsManager';
import { ValueParams } from './ValueManager';
import { Helper } from './Helper';
import { SpyI } from './Spy';
import { VerbsData } from 'rosaenlg-pug-code-gen';
import { Genders, Numbers, GendersMF } from './NlgLib';
import { getDet as getFrenchDet } from 'french-determiners';
import { agreeAdjective as agreeFrenchAdj } from 'french-adjectives-wrapper';
import frenchWordsGenderLefff from 'french-words-gender-lefff/dist/words.json';
import { GenderList as FrenchGenderList } from 'french-words-gender-lefff';
import { getGender as getGenderFrenchWord, getPlural as getFrenchPlural } from 'french-words';
import { getOrdinal as getFrenchOrdinal } from 'french-ordinals';
import 'numeral/locales/fr';
import { fr as dataFnsFr } from 'date-fns/locale';
import { parse as frenchParse } from '../dist/french-grammar.js';
import { LefffHelper } from 'lefff-helper';
import { getConjugation as libGetConjugationFr, FrenchAux, alwaysAuxEtre } from 'french-verbs';
import frenchVerbsDict from 'french-verbs-lefff/dist/conjugations.json';
import { ConjParams } from './VerbsManager';
import { LanguageCommon } from 'rosaenlg-commons';
import n2words from '../../rosaenlg-n2words/dist/n2words_FR.js';

interface ConjParamsFr extends ConjParams {
  tense: string;
  agree: any;
  aux: FrenchAux;
}

export class LanguageFrench extends LanguageImpl {
  iso2 = 'fr';
  langForNumeral = 'fr';
  langForDateFns = dataFnsFr;
  n2wordsLang = 'fr';
  n2wordsLib = n2words;
  floatingPointWord = 'virgule';
  table0to9 = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  hasGender = true;
  hasNeutral = false;
  defaultAdjPos = 'AFTER'; // In general, and unlike English, French adjectives are placed after the noun they describe
  defaultTense = 'PRESENT';
  defaultLastSeparatorForAdjectives = 'et';
  universalMapping = {
    UNIVERSAL_PRESENT: 'PRESENT',
    UNIVERSAL_PAST: 'IMPARFAIT',
    UNIVERSAL_FUTURE: 'FUTUR',
    UNIVERSAL_PERFECT: 'PASSE_COMPOSE',
    UNIVERSAL_PLUPERFECT: 'PLUS_QUE_PARFAIT',
  };
  spacesWhenSeparatingElements = true;

  constructor(languageCommon: LanguageCommon) {
    super(languageCommon);
    try {
      this.dictHelper = new LefffHelper();
    } catch (err) {
      // this means that we are in a browser
    }
  }

  getDet(det: DetTypes, params: DetParams): string {
    return getFrenchDet(
      det,
      params.genderOwned as GendersMF,
      params.numberOwned || 'S',
      params.numberOwner || 'S',
      params.adjectiveAfterDet,
      params.after,
      params.forceDes,
    );
  }

  getAgreeAdj(adjective: string, gender: Genders, number: Numbers, subject: any, params: AgreeAdjParams): string {
    return agreeFrenchAdj(
      this.getDictManager().getAdjsData(),
      adjective,
      gender as GendersMF,
      number,
      subject,
      params && params.adjPos === 'BEFORE',
      this.getDictManager().getWordData(),
    );
  }

  getWordGender(word: string): GendersMF {
    return getGenderFrenchWord(this.getDictManager().getWordData(), frenchWordsGenderLefff as FrenchGenderList, word); //NOSONAR
  }

  getOrdinal(val: number, gender: Genders): string {
    return getFrenchOrdinal(val, gender as GendersMF);
  }

  getTextualNumber(val: number, gender: Genders): string {
    if (val === 1) {
      return gender === 'F' ? 'une' : 'un';
    } else {
      return super.getTextualNumber(val, gender);
    }
  }

  getOrdinalNumber(val: number, gender: Genders): string {
    if (val == 1) {
      if (gender == 'F') {
        return '1re'; // première
      } else {
        return '1er';
      }
    } else {
      // default implementation works fine for the rest
      return super.getOrdinalNumber(val, gender);
    }
  }

  getSubstantive(subst: string, number: Numbers): string {
    if (number === 'S') {
      return subst;
    } else {
      return getFrenchPlural(this.getDictManager().getWordData(), subst);
    }
  }

  parseSimplifiedString(val: string): GrammarParsed {
    return frenchParse(val, { dictHelper: this.dictHelper });
  }

  thirdPossessionTriggerRef(owner: any, owned: any, params: any, spy: SpyI): void {
    this.valueManager.value(owned, Object.assign({}, params, { det: 'DEFINITE' }));
    spy.appendPugHtml(` de `);
    this.valueManager.value(owner, Object.assign({}, params));
  }

  thirdPossessionRefTriggered(
    owner: any,
    owned: any,
    params: any,
    spy: SpyI,
    genderNumberManager: GenderNumberManager,
  ): void {
    const det: string = this.getDet('POSSESSIVE', {
      genderOwned: genderNumberManager.getRefGender(owned, null),
      genderOwner: null,
      numberOwner: genderNumberManager.getRefNumber(owner, params),
      numberOwned: genderNumberManager.getRefNumber(owned, params),
      case: null,
      dist: null,
      after: null,
    });

    spy.appendPugHtml(` ${det} ${owned} `);
  }

  recipientPossession(owned: any, spy: SpyI, refsManager: RefsManager, helper: Helper): void {
    const nextRef: NextRef = refsManager.getNextRep(owned, { _OWNER: true });
    // vos / votre + value of the object
    spy.appendPugHtml(`${helper.getSorP(['votre', 'vos'], nextRef)} `);
    this.valueManager.value(owned, ({ _OWNER: true } as unknown) as ValueParams);
  }

  getConjugation(
    subject: any,
    verb: SomeTense,
    originalTense: string,
    number: Numbers,
    conjParams: ConjParamsFr,
    genderNumberManager: GenderNumberManager,
    embeddedVerbs: VerbsData,
  ): string {
    const solvedTense = this.solveTense(originalTense);

    let person;
    if (number === 'P') {
      person = 5;
    } else {
      person = 2;
    }
    let pronominal: boolean;
    if (conjParams && conjParams.pronominal) {
      pronominal = true;
    }
    let aux: FrenchAux;
    if (conjParams && conjParams.aux) {
      aux = conjParams.aux;
    }
    let agreeGender: GendersMF;
    let agreeNumber: Numbers;
    if (conjParams && conjParams.agree) {
      agreeGender = genderNumberManager.getRefGender(conjParams.agree, null) as GendersMF;
      agreeNumber = genderNumberManager.getRefNumber(conjParams.agree, null);
    } else if (solvedTense === 'PASSE_COMPOSE' || solvedTense === 'PLUS_QUE_PARFAIT') {
      // no explicit "agree" param, but aux is ETRE, either clearly stated or is default,
      // then agreement of the participle must be automatic
      if (aux === 'ETRE' || alwaysAuxEtre(verb)) {
        agreeGender = genderNumberManager.getRefGender(subject, null) as GendersMF;
        agreeNumber = genderNumberManager.getRefNumber(subject, null);
      }
    }

    return libGetConjugationFr(
      embeddedVerbs || frenchVerbsDict, // give the verbs that we embedded in the compiled template, if there are some; if nothing we use the lefff
      verb,
      solvedTense,
      person,
      {
        aux: aux,
        agreeGender: agreeGender,
        agreeNumber: agreeNumber,
      },
      pronominal,
    );
  }

  isPlural(val: number): boolean {
    /*
      En français, seules les quantités égales ou supérieures à 2 prennent la marque du pluriel.
      Singulier -2 < N < 2
      Pluriel |N| ≥ 2 (N ≤ -2 ou N ≥ 2)
    */
    if (val >= 2 || val <= -2) {
      return true;
    } else {
      return false;
    }
  }
}
