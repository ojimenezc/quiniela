import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Save,
  ShieldCheck,
  LogOut,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "./supabase";
import { SCORING_RULES, describePredictionScore, scorePrediction } from "./scoring";
import type { LeaderboardRow, Match, Participant, Prediction } from "./types";
import type { ReactNode } from "react";

const SESSION_KEY = "quiniela.participant";
const MAX_SCORE = 15;
const GROUP_STAGE_NAMES = new Set(Array.from({ length: 17 }, (_, index) => `Jornada ${index + 1}`));
const PHASE_TABS = [
  { id: "groups", label: "Fase de grupos" },
  { id: "round32", label: "Dieciseisavos" },
  { id: "round16", label: "Octavos" },
  { id: "quarters", label: "Cuartos" },
  { id: "semis", label: "Semis" },
  { id: "finals", label: "Finales" },
] as const;
const BRACKET_SIDES = {
  left: [
    { id: "left-round32", matchNumbers: [74, 77, 73, 75, 83, 84, 81, 82] },
    { id: "left-round16", matchNumbers: [89, 90, 93, 94] },
    { id: "left-quarters", matchNumbers: [97, 98] },
    { id: "left-semis", matchNumbers: [101] },
  ],
  right: [
    { id: "right-semis", matchNumbers: [102] },
    { id: "right-quarters", matchNumbers: [99, 100] },
    { id: "right-round16", matchNumbers: [91, 92, 95, 96] },
    { id: "right-round32", matchNumbers: [76, 78, 79, 80, 86, 88, 85, 87] },
  ],
} as const;
const BRACKET_STAGE_LABELS = ["16avos", "Octavos", "Cuartos", "Semis", "Final"] as const;
const FINAL_MATCH_NUMBER = 104;
const THIRD_PLACE_MATCH_NUMBER = 103;
const THIRD_PLACE_WINNER_SLOTS = ["A", "B", "D", "E", "G", "I", "K", "L"] as const;
type ThirdPlaceWinnerSlot = (typeof THIRD_PLACE_WINNER_SLOTS)[number];
const THIRD_PLACE_SLOT_BY_CANDIDATES = new Map<string, ThirdPlaceWinnerSlot>([
  ["CEFHI", "A"],
  ["EFGIJ", "B"],
  ["BEFIJ", "D"],
  ["ABCDF", "E"],
  ["AEHIJ", "G"],
  ["CDFGH", "I"],
  ["DEIJL", "K"],
  ["EHIJK", "L"],
]);
const FIFA_THIRD_PLACE_ASSIGNMENT_ROWS = [
  "EFGHIJKL:EJIFHGLK|DFGHIJKL:HGIDJFLK|DEGHIJKL:EJIDHGLK|DEFHIJKL:EJIDHFLK|DEFGIJKL:EGIDJFLK|DEFGHJKL:EGJDHFLK|DEFGHIKL:EGIDHFLK|DEFGHIJL:EGJDHFLI",
  "DEFGHIJK:EGJDHFIK|CFGHIJKL:HGICJFLK|CEGHIJKL:EJICHGLK|CEFHIJKL:EJICHFLK|CEFGIJKL:EGICJFLK|CEFGHJKL:EGJCHFLK|CEFGHIKL:EGICHFLK|CEFGHIJL:EGJCHFLI",
  "CEFGHIJK:EGJCHFIK|CDGHIJKL:HGICJDLK|CDFHIJKL:CJIDHFLK|CDFGIJKL:CGIDJFLK|CDFGHJKL:CGJDHFLK|CDFGHIKL:CGIDHFLK|CDFGHIJL:CGJDHFLI|CDFGHIJK:CGJDHFIK",
  "CDEHIJKL:EJICHDLK|CDEGIJKL:EGICJDLK|CDEGHJKL:EGJCHDLK|CDEGHIKL:EGICHDLK|CDEGHIJL:EGJCHDLI|CDEGHIJK:EGJCHDIK|CDEFIJKL:CJEDIFLK|CDEFHJKL:CJEDHFLK",
  "CDEFHIKL:CEIDHFLK|CDEFHIJL:CJEDHFLI|CDEFHIJK:CJEDHFIK|CDEFGJKL:CGEDJFLK|CDEFGIKL:CGEDIFLK|CDEFGIJL:CGEDJFLI|CDEFGIJK:CGEDJFIK|CDEFGHKL:CGEDHFLK",
  "CDEFGHJL:CGJDHFLE|CDEFGHJK:CGJDHFEK|CDEFGHIL:CGEDHFLI|CDEFGHIK:CGEDHFIK|CDEFGHIJ:CGJDHFEI|BFGHIJKL:HJBFIGLK|BEGHIJKL:EJIBHGLK|BEFHIJKL:EJBFIHLK",
  "BEFGIJKL:EJBFIGLK|BEFGHJKL:EJBFHGLK|BEFGHIKL:EGBFIHLK|BEFGHIJL:EJBFHGLI|BEFGHIJK:EJBFHGIK|BDGHIJKL:HJBDIGLK|BDFHIJKL:HJBDIFLK|BDFGIJKL:IGBDJFLK",
  "BDFGHJKL:HGBDJFLK|BDFGHIKL:HGBDIFLK|BDFGHIJL:HGBDJFLI|BDFGHIJK:HGBDJFIK|BDEHIJKL:EJBDIHLK|BDEGIJKL:EJBDIGLK|BDEGHJKL:EJBDHGLK|BDEGHIKL:EGBDIHLK",
  "BDEGHIJL:EJBDHGLI|BDEGHIJK:EJBDHGIK|BDEFIJKL:EJBDIFLK|BDEFHJKL:EJBDHFLK|BDEFHIKL:EIBDHFLK|BDEFHIJL:EJBDHFLI|BDEFHIJK:EJBDHFIK|BDEFGJKL:EGBDJFLK",
  "BDEFGIKL:EGBDIFLK|BDEFGIJL:EGBDJFLI|BDEFGIJK:EGBDJFIK|BDEFGHKL:EGBDHFLK|BDEFGHJL:HGBDJFLE|BDEFGHJK:HGBDJFEK|BDEFGHIL:EGBDHFLI|BDEFGHIK:EGBDHFIK",
  "BDEFGHIJ:HGBDJFEI|BCGHIJKL:HJBCIGLK|BCFHIJKL:HJBCIFLK|BCFGIJKL:IGBCJFLK|BCFGHJKL:HGBCJFLK|BCFGHIKL:HGBCIFLK|BCFGHIJL:HGBCJFLI|BCFGHIJK:HGBCJFIK",
  "BCEHIJKL:EJBCIHLK|BCEGIJKL:EJBCIGLK|BCEGHJKL:EJBCHGLK|BCEGHIKL:EGBCIHLK|BCEGHIJL:EJBCHGLI|BCEGHIJK:EJBCHGIK|BCEFIJKL:EJBCIFLK|BCEFHJKL:EJBCHFLK",
  "BCEFHIKL:EIBCHFLK|BCEFHIJL:EJBCHFLI|BCEFHIJK:EJBCHFIK|BCEFGJKL:EGBCJFLK|BCEFGIKL:EGBCIFLK|BCEFGIJL:EGBCJFLI|BCEFGIJK:EGBCJFIK|BCEFGHKL:EGBCHFLK",
  "BCEFGHJL:HGBCJFLE|BCEFGHJK:HGBCJFEK|BCEFGHIL:EGBCHFLI|BCEFGHIK:EGBCHFIK|BCEFGHIJ:HGBCJFEI|BCDHIJKL:HJBCIDLK|BCDGIJKL:IGBCJDLK|BCDGHJKL:HGBCJDLK",
  "BCDGHIKL:HGBCIDLK|BCDGHIJL:HGBCJDLI|BCDGHIJK:HGBCJDIK|BCDFIJKL:CJBDIFLK|BCDFHJKL:CJBDHFLK|BCDFHIKL:CIBDHFLK|BCDFHIJL:CJBDHFLI|BCDFHIJK:CJBDHFIK",
  "BCDFGJKL:CGBDJFLK|BCDFGIKL:CGBDIFLK|BCDFGIJL:CGBDJFLI|BCDFGIJK:CGBDJFIK|BCDFGHKL:CGBDHFLK|BCDFGHJL:CGBDHFLJ|BCDFGHJK:HGBCJFDK|BCDFGHIL:CGBDHFLI",
  "BCDFGHIK:CGBDHFIK|BCDFGHIJ:HGBCJFDI|BCDEIJKL:EJBCIDLK|BCDEHJKL:EJBCHDLK|BCDEHIKL:EIBCHDLK|BCDEHIJL:EJBCHDLI|BCDEHIJK:EJBCHDIK|BCDEGJKL:EGBCJDLK",
  "BCDEGIKL:EGBCIDLK|BCDEGIJL:EGBCJDLI|BCDEGIJK:EGBCJDIK|BCDEGHKL:EGBCHDLK|BCDEGHJL:HGBCJDLE|BCDEGHJK:HGBCJDEK|BCDEGHIL:EGBCHDLI|BCDEGHIK:EGBCHDIK",
  "BCDEGHIJ:HGBCJDEI|BCDEFJKL:CJBDEFLK|BCDEFIKL:CEBDIFLK|BCDEFIJL:CJBDEFLI|BCDEFIJK:CJBDEFIK|BCDEFHKL:CEBDHFLK|BCDEFHJL:CJBDHFLE|BCDEFHJK:CJBDHFEK",
  "BCDEFHIL:CEBDHFLI|BCDEFHIK:CEBDHFIK|BCDEFHIJ:CJBDHFEI|BCDEFGKL:CGBDEFLK|BCDEFGJL:CGBDJFLE|BCDEFGJK:CGBDJFEK|BCDEFGIL:CGBDEFLI|BCDEFGIK:CGBDEFIK",
  "BCDEFGIJ:CGBDJFEI|BCDEFGHL:CGBDHFLE|BCDEFGHK:CGBDHFEK|BCDEFGHJ:HGBCJFDE|BCDEFGHI:CGBDHFEI|AFGHIJKL:HJIFAGLK|AEGHIJKL:EJIAHGLK|AEFHIJKL:EJIFAHLK",
  "AEFGIJKL:EJIFAGLK|AEFGHJKL:EGJFAHLK|AEFGHIKL:EGIFAHLK|AEFGHIJL:EGJFAHLI|AEFGHIJK:EGJFAHIK|ADGHIJKL:HJIDAGLK|ADFHIJKL:HJIDAFLK|ADFGIJKL:IGJDAFLK",
  "ADFGHJKL:HGJDAFLK|ADFGHIKL:HGIDAFLK|ADFGHIJL:HGJDAFLI|ADFGHIJK:HGJDAFIK|ADEHIJKL:EJIDAHLK|ADEGIJKL:EJIDAGLK|ADEGHJKL:EGJDAHLK|ADEGHIKL:EGIDAHLK",
  "ADEGHIJL:EGJDAHLI|ADEGHIJK:EGJDAHIK|ADEFIJKL:EJIDAFLK|ADEFHJKL:HJEDAFLK|ADEFHIKL:HEIDAFLK|ADEFHIJL:HJEDAFLI|ADEFHIJK:HJEDAFIK|ADEFGJKL:EGJDAFLK",
  "ADEFGIKL:EGIDAFLK|ADEFGIJL:EGJDAFLI|ADEFGIJK:EGJDAFIK|ADEFGHKL:HGEDAFLK|ADEFGHJL:HGJDAFLE|ADEFGHJK:HGJDAFEK|ADEFGHIL:HGEDAFLI|ADEFGHIK:HGEDAFIK",
  "ADEFGHIJ:HGJDAFEI|ACGHIJKL:HJICAGLK|ACFHIJKL:HJICAFLK|ACFGIJKL:IGJCAFLK|ACFGHJKL:HGJCAFLK|ACFGHIKL:HGICAFLK|ACFGHIJL:HGJCAFLI|ACFGHIJK:HGJCAFIK",
  "ACEHIJKL:EJICAHLK|ACEGIJKL:EJICAGLK|ACEGHJKL:EGJCAHLK|ACEGHIKL:EGICAHLK|ACEGHIJL:EGJCAHLI|ACEGHIJK:EGJCAHIK|ACEFIJKL:EJICAFLK|ACEFHJKL:HJECAFLK",
  "ACEFHIKL:HEICAFLK|ACEFHIJL:HJECAFLI|ACEFHIJK:HJECAFIK|ACEFGJKL:EGJCAFLK|ACEFGIKL:EGICAFLK|ACEFGIJL:EGJCAFLI|ACEFGIJK:EGJCAFIK|ACEFGHKL:HGECAFLK",
  "ACEFGHJL:HGJCAFLE|ACEFGHJK:HGJCAFEK|ACEFGHIL:HGECAFLI|ACEFGHIK:HGECAFIK|ACEFGHIJ:HGJCAFEI|ACDHIJKL:HJICADLK|ACDGIJKL:IGJCADLK|ACDGHJKL:HGJCADLK",
  "ACDGHIKL:HGICADLK|ACDGHIJL:HGJCADLI|ACDGHIJK:HGJCADIK|ACDFIJKL:CJIDAFLK|ACDFHJKL:HJFCADLK|ACDFHIKL:HFICADLK|ACDFHIJL:HJFCADLI|ACDFHIJK:HJFCADIK",
  "ACDFGJKL:CGJDAFLK|ACDFGIKL:CGIDAFLK|ACDFGIJL:CGJDAFLI|ACDFGIJK:CGJDAFIK|ACDFGHKL:HGFCADLK|ACDFGHJL:CGJDAFLH|ACDFGHJK:HGJCAFDK|ACDFGHIL:HGFCADLI",
  "ACDFGHIK:HGFCADIK|ACDFGHIJ:HGJCAFDI|ACDEIJKL:EJICADLK|ACDEHJKL:HJECADLK|ACDEHIKL:HEICADLK|ACDEHIJL:HJECADLI|ACDEHIJK:HJECADIK|ACDEGJKL:EGJCADLK",
  "ACDEGIKL:EGICADLK|ACDEGIJL:EGJCADLI|ACDEGIJK:EGJCADIK|ACDEGHKL:HGECADLK|ACDEGHJL:HGJCADLE|ACDEGHJK:HGJCADEK|ACDEGHIL:HGECADLI|ACDEGHIK:HGECADIK",
  "ACDEGHIJ:HGJCADEI|ACDEFJKL:CJEDAFLK|ACDEFIKL:CEIDAFLK|ACDEFIJL:CJEDAFLI|ACDEFIJK:CJEDAFIK|ACDEFHKL:HEFCADLK|ACDEFHJL:HJFCADLE|ACDEFHJK:HJECAFDK",
  "ACDEFHIL:HEFCADLI|ACDEFHIK:HEFCADIK|ACDEFHIJ:HJECAFDI|ACDEFGKL:CGEDAFLK|ACDEFGJL:CGJDAFLE|ACDEFGJK:CGJDAFEK|ACDEFGIL:CGEDAFLI|ACDEFGIK:CGEDAFIK",
  "ACDEFGIJ:CGJDAFEI|ACDEFGHL:HGFCADLE|ACDEFGHK:HGECAFDK|ACDEFGHJ:HGJCAFDE|ACDEFGHI:HGECAFDI|ABGHIJKL:HJBAIGLK|ABFHIJKL:HJBAIFLK|ABFGIJKL:IJBFAGLK",
  "ABFGHJKL:HJBFAGLK|ABFGHIKL:HGBAIFLK|ABFGHIJL:HJBFAGLI|ABFGHIJK:HJBFAGIK|ABEHIJKL:EJBAIHLK|ABEGIJKL:EJBAIGLK|ABEGHJKL:EJBAHGLK|ABEGHIKL:EGBAIHLK",
  "ABEGHIJL:EJBAHGLI|ABEGHIJK:EJBAHGIK|ABEFIJKL:EJBAIFLK|ABEFHJKL:EJBFAHLK|ABEFHIKL:EIBFAHLK|ABEFHIJL:EJBFAHLI|ABEFHIJK:EJBFAHIK|ABEFGJKL:EJBFAGLK",
  "ABEFGIKL:EGBAIFLK|ABEFGIJL:EJBFAGLI|ABEFGIJK:EJBFAGIK|ABEFGHKL:EGBFAHLK|ABEFGHJL:HJBFAGLE|ABEFGHJK:HJBFAGEK|ABEFGHIL:EGBFAHLI|ABEFGHIK:EGBFAHIK",
  "ABEFGHIJ:HJBFAGEI|ABDHIJKL:IJBDAHLK|ABDGIJKL:IJBDAGLK|ABDGHJKL:HJBDAGLK|ABDGHIKL:IGBDAHLK|ABDGHIJL:HJBDAGLI|ABDGHIJK:HJBDAGIK|ABDFIJKL:IJBDAFLK",
  "ABDFHJKL:HJBDAFLK|ABDFHIKL:HIBDAFLK|ABDFHIJL:HJBDAFLI|ABDFHIJK:HJBDAFIK|ABDFGJKL:FJBDAGLK|ABDFGIKL:IGBDAFLK|ABDFGIJL:FJBDAGLI|ABDFGIJK:FJBDAGIK",
  "ABDFGHKL:HGBDAFLK|ABDFGHJL:HGBDAFLJ|ABDFGHJK:HGBDAFJK|ABDFGHIL:HGBDAFLI|ABDFGHIK:HGBDAFIK|ABDFGHIJ:HGBDAFIJ|ABDEIJKL:EJBAIDLK|ABDEHJKL:EJBDAHLK",
  "ABDEHIKL:EIBDAHLK|ABDEHIJL:EJBDAHLI|ABDEHIJK:EJBDAHIK|ABDEGJKL:EJBDAGLK|ABDEGIKL:EGBAIDLK|ABDEGIJL:EJBDAGLI|ABDEGIJK:EJBDAGIK|ABDEGHKL:EGBDAHLK",
  "ABDEGHJL:HJBDAGLE|ABDEGHJK:HJBDAGEK|ABDEGHIL:EGBDAHLI|ABDEGHIK:EGBDAHIK|ABDEGHIJ:HJBDAGEI|ABDEFJKL:EJBDAFLK|ABDEFIKL:EIBDAFLK|ABDEFIJL:EJBDAFLI",
  "ABDEFIJK:EJBDAFIK|ABDEFHKL:HEBDAFLK|ABDEFHJL:HJBDAFLE|ABDEFHJK:HJBDAFEK|ABDEFHIL:HEBDAFLI|ABDEFHIK:HEBDAFIK|ABDEFHIJ:HJBDAFEI|ABDEFGKL:EGBDAFLK",
  "ABDEFGJL:EGBDAFLJ|ABDEFGJK:EGBDAFJK|ABDEFGIL:EGBDAFLI|ABDEFGIK:EGBDAFIK|ABDEFGIJ:EGBDAFIJ|ABDEFGHL:HGBDAFLE|ABDEFGHK:HGBDAFEK|ABDEFGHJ:HGBDAFEJ",
  "ABDEFGHI:HGBDAFEI|ABCHIJKL:IJBCAHLK|ABCGIJKL:IJBCAGLK|ABCGHJKL:HJBCAGLK|ABCGHIKL:IGBCAHLK|ABCGHIJL:HJBCAGLI|ABCGHIJK:HJBCAGIK|ABCFIJKL:IJBCAFLK",
  "ABCFHJKL:HJBCAFLK|ABCFHIKL:HIBCAFLK|ABCFHIJL:HJBCAFLI|ABCFHIJK:HJBCAFIK|ABCFGJKL:CJBFAGLK|ABCFGIKL:IGBCAFLK|ABCFGIJL:CJBFAGLI|ABCFGIJK:CJBFAGIK",
  "ABCFGHKL:HGBCAFLK|ABCFGHJL:HGBCAFLJ|ABCFGHJK:HGBCAFJK|ABCFGHIL:HGBCAFLI|ABCFGHIK:HGBCAFIK|ABCFGHIJ:HGBCAFIJ|ABCEIJKL:EJBAICLK|ABCEHJKL:EJBCAHLK",
  "ABCEHIKL:EIBCAHLK|ABCEHIJL:EJBCAHLI|ABCEHIJK:EJBCAHIK|ABCEGJKL:EJBCAGLK|ABCEGIKL:EGBAICLK|ABCEGIJL:EJBCAGLI|ABCEGIJK:EJBCAGIK|ABCEGHKL:EGBCAHLK",
  "ABCEGHJL:HJBCAGLE|ABCEGHJK:HJBCAGEK|ABCEGHIL:EGBCAHLI|ABCEGHIK:EGBCAHIK|ABCEGHIJ:HJBCAGEI|ABCEFJKL:EJBCAFLK|ABCEFIKL:EIBCAFLK|ABCEFIJL:EJBCAFLI",
  "ABCEFIJK:EJBCAFIK|ABCEFHKL:HEBCAFLK|ABCEFHJL:HJBCAFLE|ABCEFHJK:HJBCAFEK|ABCEFHIL:HEBCAFLI|ABCEFHIK:HEBCAFIK|ABCEFHIJ:HJBCAFEI|ABCEFGKL:EGBCAFLK",
  "ABCEFGJL:EGBCAFLJ|ABCEFGJK:EGBCAFJK|ABCEFGIL:EGBCAFLI|ABCEFGIK:EGBCAFIK|ABCEFGIJ:EGBCAFIJ|ABCEFGHL:HGBCAFLE|ABCEFGHK:HGBCAFEK|ABCEFGHJ:HGBCAFEJ",
  "ABCEFGHI:HGBCAFEI|ABCDIJKL:IJBCADLK|ABCDHJKL:HJBCADLK|ABCDHIKL:HIBCADLK|ABCDHIJL:HJBCADLI|ABCDHIJK:HJBCADIK|ABCDGJKL:CJBDAGLK|ABCDGIKL:IGBCADLK",
  "ABCDGIJL:CJBDAGLI|ABCDGIJK:CJBDAGIK|ABCDGHKL:HGBCADLK|ABCDGHJL:HGBCADLJ|ABCDGHJK:HGBCADJK|ABCDGHIL:HGBCADLI|ABCDGHIK:HGBCADIK|ABCDGHIJ:HGBCADIJ",
  "ABCDFJKL:CJBDAFLK|ABCDFIKL:CIBDAFLK|ABCDFIJL:CJBDAFLI|ABCDFIJK:CJBDAFIK|ABCDFHKL:HFBCADLK|ABCDFHJL:CJBDAFLH|ABCDFHJK:HJBCAFDK|ABCDFHIL:HFBCADLI",
  "ABCDFHIK:HFBCADIK|ABCDFHIJ:HJBCAFDI|ABCDFGKL:CGBDAFLK|ABCDFGJL:CGBDAFLJ|ABCDFGJK:CGBDAFJK|ABCDFGIL:CGBDAFLI|ABCDFGIK:CGBDAFIK|ABCDFGIJ:CGBDAFIJ",
  "ABCDFGHL:CGBDAFLH|ABCDFGHK:HGBCAFDK|ABCDFGHJ:HGBCAFDJ|ABCDFGHI:HGBCAFDI|ABCDEJKL:EJBCADLK|ABCDEIKL:EIBCADLK|ABCDEIJL:EJBCADLI|ABCDEIJK:EJBCADIK",
  "ABCDEHKL:HEBCADLK|ABCDEHJL:HJBCADLE|ABCDEHJK:HJBCADEK|ABCDEHIL:HEBCADLI|ABCDEHIK:HEBCADIK|ABCDEHIJ:HJBCADEI|ABCDEGKL:EGBCADLK|ABCDEGJL:EGBCADLJ",
  "ABCDEGJK:EGBCADJK|ABCDEGIL:EGBCADLI|ABCDEGIK:EGBCADIK|ABCDEGIJ:EGBCADIJ|ABCDEGHL:HGBCADLE|ABCDEGHK:HGBCADEK|ABCDEGHJ:HGBCADEJ|ABCDEGHI:HGBCADEI",
  "ABCDEFKL:CEBDAFLK|ABCDEFJL:CJBDAFLE|ABCDEFJK:CJBDAFEK|ABCDEFIL:CEBDAFLI|ABCDEFIK:CEBDAFIK|ABCDEFIJ:CJBDAFEI|ABCDEFHL:HFBCADLE|ABCDEFHK:HEBCAFDK",
  "ABCDEFHJ:HJBCAFDE|ABCDEFHI:HEBCAFDI|ABCDEFGL:CGBDAFLE|ABCDEFGK:CGBDAFEK|ABCDEFGJ:CGBDAFEJ|ABCDEFGI:CGBDAFEI|ABCDEFGH:HGBCAFDE",
];
const FIFA_THIRD_PLACE_ASSIGNMENTS = new Map(
  FIFA_THIRD_PLACE_ASSIGNMENT_ROWS.flatMap((row) => row.split("|")).map((entry) => {
    const [qualifiedGroups, slotAssignments] = entry.split(":");
    return [
      qualifiedGroups,
      new Map(
        THIRD_PLACE_WINNER_SLOTS.map((slot, index) => [slot, slotAssignments[index]]),
      ),
    ] as const;
  }),
);
const TEAM_FLAGS: Record<string, string> = {
  Alemania: "🇩🇪",
  "Arabia Saudita": "🇸🇦",
  Argelia: "🇩🇿",
  Argentina: "🇦🇷",
  Australia: "🇦🇺",
  Austria: "🇦🇹",
  Bélgica: "🇧🇪",
  "Bosnia y Herzegovina": "🇧🇦",
  Brasil: "🇧🇷",
  "Cabo Verde": "🇨🇻",
  Canadá: "🇨🇦",
  Catar: "🇶🇦",
  Colombia: "🇨🇴",
  "Corea del Sur": "🇰🇷",
  "Costa de Marfil": "🇨🇮",
  Croacia: "🇭🇷",
  Curazao: "🇨🇼",
  Ecuador: "🇪🇨",
  Egipto: "🇪🇬",
  Escocia: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  España: "🇪🇸",
  "Estados Unidos": "🇺🇸",
  Francia: "🇫🇷",
  Ghana: "🇬🇭",
  Haití: "🇭🇹",
  Inglaterra: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  Irak: "🇮🇶",
  Irán: "🇮🇷",
  Japón: "🇯🇵",
  Jordania: "🇯🇴",
  Marruecos: "🇲🇦",
  México: "🇲🇽",
  Noruega: "🇳🇴",
  "Nueva Zelanda": "🇳🇿",
  Panamá: "🇵🇦",
  Paraguay: "🇵🇾",
  "Países Bajos": "🇳🇱",
  Portugal: "🇵🇹",
  "RD Congo": "🇨🇩",
  Chequia: "🇨🇿",
  "República Checa": "🇨🇿",
  Senegal: "🇸🇳",
  Sudáfrica: "🇿🇦",
  Suecia: "🇸🇪",
  Suiza: "🇨🇭",
  Túnez: "🇹🇳",
  Turquía: "🇹🇷",
  Uruguay: "🇺🇾",
  Uzbekistán: "🇺🇿",
};
const TEAM_DISPLAY_NAMES: Record<string, string> = {
  "República Checa": "Chequia",
};

type PhaseTab = (typeof PHASE_TABS)[number]["id"];
type MainTab = "predictions" | "standings" | "bracket";
type ScoreInput = number | "";
type GroupStandingRow = {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};
type MatchGroupData = { title: string; matches: Match[] };
type HeadToHeadStats = {
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

function isAdminParticipant(participant: Participant | null | undefined) {
  return Boolean(participant?.is_admin || participant?.name.trim().toLowerCase() === "admin");
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), MAX_SCORE);
}

function readScoreInput(value: string): ScoreInput {
  return value === "" ? "" : clampScore(Number(value));
}

function isMatchLocked(match: Match, now = Date.now()) {
  const startsAt = new Date(match.starts_at).getTime();
  return match.status === "finished" || (Number.isFinite(startsAt) && startsAt <= now);
}

function hasCompleteScore(match: Match): match is Match & { home_score: number; away_score: number } {
  return match.home_score !== null && match.away_score !== null;
}

function TeamName({ name }: { name: string }) {
  const flag = TEAM_FLAGS[name];
  const displayName = TEAM_DISPLAY_NAMES[name] ?? name;

  return (
    <span className="team-name">
      {flag && (
        <span className="team-flag" aria-hidden="true">
          {flag}
        </span>
      )}
      <span>{displayName}</span>
    </span>
  );
}

export function App() {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activePhase, setActivePhase] = useState<PhaseTab>("groups");
  const [activeGroupTitle, setActiveGroupTitle] = useState<string>("");
  const [activeAdminPhase, setActiveAdminPhase] = useState<PhaseTab>("groups");
  const [activeAdminGroupTitle, setActiveAdminGroupTitle] = useState<string>("");
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("predictions");
  const [now, setNow] = useState(() => Date.now());
  const [didSelectCurrentDate, setDidSelectCurrentDate] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const savedParticipant = JSON.parse(raw) as Participant | null;
        if (savedParticipant?.id) setParticipant(savedParticipant);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    void loadData();
  }, []);

  useEffect(() => {
    if (!message || !participant) return;

    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [message, participant]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  async function loadData() {
    setLoading(true);
    const [participantsResult, matchesResult, predictionsResult] = await Promise.all([
      supabase.from("participants").select("*").order("created_at"),
      supabase.from("matches").select("*").order("starts_at"),
      supabase.from("predictions").select("*"),
    ]);

    if (participantsResult.error || matchesResult.error || predictionsResult.error) {
      setMessage("No se pudieron cargar los datos de la quiniela.");
    } else {
      setParticipants(participantsResult.data ?? []);
      setMatches(matchesResult.data ?? []);
      setPredictions(predictionsResult.data ?? []);
    }
    setLoading(false);
  }

  async function handleLogin(name: string, pin: string) {
    const cleanName = name.trim();
    const cleanPin = pin.trim();
    if (!cleanName || !cleanPin) return;

    const existing = participants.find(
      (item) => item.name.toLowerCase() === cleanName.toLowerCase() && item.pin === cleanPin,
    );

    if (existing) {
      setParticipant(existing);
      localStorage.setItem(SESSION_KEY, JSON.stringify(existing));
      return;
    }

    const nameTaken = participants.some((item) => item.name.toLowerCase() === cleanName.toLowerCase());
    if (nameTaken) {
      setMessage("Ese nombre ya existe. Revisa el PIN o usa otro alias.");
      return;
    }

    const { data, error } = await supabase
      .from("participants")
      .insert({ name: cleanName, pin: cleanPin, is_admin: false })
      .select()
      .single();

    if (error) {
      setMessage("No se pudo crear el participante.");
      return;
    }

    setParticipant(data);
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    await loadData();
  }

  async function savePrediction(matchId: string, homeScore: number, awayScore: number) {
    if (!participant) return false;

    const match = matches.find((item) => item.id === matchId);
    if (!match || isMatchLocked(match)) {
      setMessage("Este partido está cerrado. No se puede modificar el pronóstico.");
      return false;
    }

    const nextHomeScore = clampScore(homeScore);
    const nextAwayScore = clampScore(awayScore);
    const { data, error } = await supabase.from("predictions").upsert(
      {
        participant_id: participant.id,
        match_id: matchId,
        home_score: nextHomeScore,
        away_score: nextAwayScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "participant_id,match_id" },
    ).select().single();

    if (error || !data) {
      setMessage("No se pudo guardar el pronóstico.");
      return false;
    }

    setPredictions((currentPredictions) => {
      const exists = currentPredictions.some((item) => item.id === data.id);
      if (exists) {
        return currentPredictions.map((item) => (item.id === data.id ? data : item));
      }
      return [...currentPredictions, data];
    });
    setMessage("Pronóstico guardado.");
    return true;
  }

  async function saveResult(matchId: string, homeScore: number, awayScore: number) {
    const { error } = await supabase
      .from("matches")
      .update({ home_score: clampScore(homeScore), away_score: clampScore(awayScore) })
      .eq("id", matchId);

    setMessage(error ? "No se pudo guardar el marcador." : "Marcador actualizado.");
    await loadData();
  }

  async function saveTeams(matchId: string, homeTeam: string, awayTeam: string) {
    const cleanHomeTeam = homeTeam.trim();
    const cleanAwayTeam = awayTeam.trim();
    if (!cleanHomeTeam || !cleanAwayTeam) {
      setMessage("Debes ingresar ambos equipos.");
      return;
    }

    const { error } = await supabase
      .from("matches")
      .update({ home_team: cleanHomeTeam, away_team: cleanAwayTeam })
      .eq("id", matchId);

    setMessage(error ? "No se pudieron guardar los equipos." : "Equipos actualizados.");
    await loadData();
  }

  async function finishMatch(matchId: string) {
    const { error } = await supabase.from("matches").update({ status: "finished" }).eq("id", matchId);

    setMessage(error ? "No se pudo cerrar el partido." : "Partido marcado como finalizado.");
    await loadData();
  }

  async function clearResult(matchId: string) {
    const { error } = await supabase
      .from("matches")
      .update({ home_score: null, away_score: null, status: "scheduled" })
      .eq("id", matchId);

    setMessage(error ? "No se pudo quitar el resultado." : "Resultado quitado.");
    await loadData();
  }

  const leaderboard = useMemo(() => {
    const rankingParticipants =
      participant && !participants.some((item) => item.id === participant.id)
        ? [...participants, participant]
        : participants;

    const rows = rankingParticipants.filter((item) => !isAdminParticipant(item)).map<LeaderboardRow>((item) => {
      let points = 0;
      let exactHits = 0;
      let resultHits = 0;
      let resultOnlyHits = 0;
      let goalHits = 0;
      let goalBonusHits = 0;
      let scoredPredictions = 0;
      let predictionCount = 0;

      for (const match of matches) {
        const prediction = predictions.find(
          (candidate) => candidate.participant_id === item.id && candidate.match_id === match.id,
        );
        if (prediction) predictionCount += 1;
        const score = scorePrediction(match, prediction);
        points += score.points;
        exactHits += Number(score.exactHit);
        resultHits += Number(score.resultHit);
        resultOnlyHits += Number(score.resultHit && !score.exactHit);
        goalHits += score.goalHits;
        goalBonusHits += score.exactHit ? 0 : score.goalHits;
        scoredPredictions += Number(
          Boolean(prediction) &&
            match.home_score !== null &&
            match.away_score !== null,
        );
      }

      return {
        participant: item,
        points,
        exactHits,
        resultHits,
        resultOnlyHits,
        goalHits,
        goalBonusHits,
        scoredPredictions,
        predictions: predictionCount,
      };
    });

    return rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
      return b.resultHits - a.resultHits;
    });
  }, [matches, participant, participants, predictions]);

  const resolvedMatches = useMemo(() => resolveAutomaticTeams(matches), [matches]);
  const groupedMatches = useMemo(() => groupMatchesByStage(resolvedMatches), [resolvedMatches]);
  const groupStandings = useMemo(() => buildGroupStandings(matches), [matches]);
  const officialResultsCount = useMemo(
    () =>
      matches.filter(
        (match) => match.status === "finished" && match.home_score !== null && match.away_score !== null,
      ).length,
    [matches],
  );
  const scoreableResultsCount = useMemo(
    () => matches.filter((match) => hasCompleteScore(match)).length,
    [matches],
  );
  const visibleGroups = useMemo(
    () => groupedMatches.filter((group) => getPhaseTab(group.title) === activePhase),
    [activePhase, groupedMatches],
  );
  const selectedGroupTitle = activeGroupTitle || visibleGroups[0]?.title || "";
  const selectedGroup = visibleGroups.find((group) => group.title === selectedGroupTitle) ?? visibleGroups[0];
  const isAdmin = isAdminParticipant(participant);
  const adminVisibleGroups = useMemo(
    () => groupedMatches.filter((group) => getPhaseTab(group.title) === activeAdminPhase),
    [activeAdminPhase, groupedMatches],
  );
  const selectedAdminGroupTitle = activeAdminGroupTitle || adminVisibleGroups[0]?.title || "";
  const selectedAdminGroup =
    adminVisibleGroups.find((group) => group.title === selectedAdminGroupTitle) ?? adminVisibleGroups[0];
  const currentParticipantRank =
    !participant
      ? "-"
      : isAdmin
        ? "Admin"
        : scoreableResultsCount === 0
          ? "Sin resultados"
          : `#${leaderboard.findIndex((row) => row.participant.id === participant.id) + 1}`;
  const todaysMatchesCount = useMemo(() => countMatchesOnLocalDate(matches, now), [matches, now]);
  const pendingResultsCount = matches.length - officialResultsCount;

  useEffect(() => {
    if (didSelectCurrentDate || groupedMatches.length === 0) return;

    const currentSelection = findCurrentMatchGroup(groupedMatches, now);
    if (currentSelection) {
      setActivePhase(getPhaseTab(currentSelection.title));
      setActiveGroupTitle(currentSelection.title);
      setActiveAdminPhase(getPhaseTab(currentSelection.title));
      setActiveAdminGroupTitle(currentSelection.title);
      setDidSelectCurrentDate(true);
    }
  }, [didSelectCurrentDate, groupedMatches, now]);

  useEffect(() => {
    const currentSelection = findCurrentMatchGroup(groupedMatches, now);
    const fallbackGroupTitle =
      currentSelection && getPhaseTab(currentSelection.title) === activePhase
        ? currentSelection.title
        : visibleGroups[0]?.title ?? "";
    if (fallbackGroupTitle && !visibleGroups.some((group) => group.title === activeGroupTitle)) {
      setActiveGroupTitle(fallbackGroupTitle);
    }
  }, [activeGroupTitle, activePhase, groupedMatches, now, visibleGroups]);

  useEffect(() => {
    const currentSelection = findCurrentMatchGroup(groupedMatches, now);
    const fallbackGroupTitle =
      currentSelection && getPhaseTab(currentSelection.title) === activeAdminPhase
        ? currentSelection.title
        : adminVisibleGroups[0]?.title ?? "";
    if (fallbackGroupTitle && !adminVisibleGroups.some((group) => group.title === activeAdminGroupTitle)) {
      setActiveAdminGroupTitle(fallbackGroupTitle);
    }
  }, [activeAdminGroupTitle, activeAdminPhase, adminVisibleGroups, groupedMatches, now]);

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setParticipant(null);
  }

  if (!participant) {
    return <LoginScreen loading={loading} message={message} onLogin={handleLogin} />;
  }

  return (
    <main className="app-shell">
      <div className="field-glow" aria-hidden="true" />
      <div className="ball-run" aria-hidden="true" />
      <header className="topbar">
        <div>
          <p className="eyebrow">Quiniela Mundial</p>
          <h1>Hola, {participant.name}</h1>
        </div>
        <button className="icon-button" onClick={logout} aria-label="Salir" title="Salir">
          <LogOut size={20} />
        </button>
      </header>

      {message && (
        <div className="toast" role="status" aria-live="polite">
          {message}
        </div>
      )}

      <section className="summary-grid">
        {isAdmin ? (
          <>
            <Metric label="Resultados oficiales" value={`${officialResultsCount}/${matches.length}`} />
            <Metric label="Marcadores cargados" value={`${scoreableResultsCount}/${matches.length}`} />
            <Metric label="Partidos de hoy" value={String(todaysMatchesCount)} />
            <Metric label="Pendientes" value={String(pendingResultsCount)} />
          </>
        ) : (
          <>
            <Metric label="Tu posición" value={currentParticipantRank} />
            <Metric
              label="Tus puntos"
              value={String(leaderboard.find((row) => row.participant.id === participant.id)?.points ?? 0)}
            />
            <Metric label="Marcadores puntuables" value={`${scoreableResultsCount}/${matches.length}`} />
          </>
        )}
      </section>

      {!isAdmin && (
        <div className="layout">
          <section className="panel">
            <div className="main-tabs" role="tablist" aria-label="Vista principal">
              <button
                type="button"
                className={activeMainTab === "predictions" ? "active" : ""}
                onClick={() => setActiveMainTab("predictions")}
              >
                <Trophy size={18} />
                Pronósticos
              </button>
              <button
                type="button"
                className={activeMainTab === "standings" ? "active" : ""}
                onClick={() => setActiveMainTab("standings")}
              >
                <BarChart3 size={18} />
                Grupos
              </button>
              <button
                type="button"
                className={activeMainTab === "bracket" ? "active" : ""}
                onClick={() => setActiveMainTab("bracket")}
              >
                <Trophy size={18} />
                Camino a la final
              </button>
            </div>
            {activeMainTab === "predictions" && (
              <section>
                <div className="section-heading">
                  <Trophy size={20} />
                  <h2>Mis pronósticos</h2>
                </div>
                <ScoringRules />
                {loading ? (
                  <p>Cargando...</p>
                ) : (
                  <>
                    <PhaseTabs activePhase={activePhase} onChange={setActivePhase} groups={groupedMatches} />
                    {visibleGroups.length > 1 && (
                      <GroupCarousel
                        groups={visibleGroups}
                        activeTitle={selectedGroupTitle}
                        onChange={setActiveGroupTitle}
                      />
                    )}
                    {selectedGroup && (
                      <MatchGroup title={selectedGroup.title} matches={selectedGroup.matches}>
                        {selectedGroup.matches.map((match) => (
                          <PredictionRow
                            key={match.id}
                            match={match}
                            now={now}
                            prediction={predictions.find(
                              (item) => item.participant_id === participant.id && item.match_id === match.id,
                            )}
                            onSave={savePrediction}
                          />
                        ))}
                      </MatchGroup>
                    )}
                  </>
                )}
              </section>
            )}
            {activeMainTab === "standings" && (
              <section>
                <div className="section-heading">
                  <BarChart3 size={20} />
                  <h2>Grupos y posiciones</h2>
                </div>
                {loading ? <p>Cargando...</p> : <GroupStandings groups={groupStandings} />}
              </section>
            )}
            {activeMainTab === "bracket" && (
              <section>
                <div className="section-heading">
                  <Trophy size={20} />
                  <h2>Camino a la final</h2>
                </div>
                {loading ? (
                  <p>Cargando...</p>
                ) : (
                  <KnockoutBracket matches={resolvedMatches} />
                )}
              </section>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <BarChart3 size={20} />
              <h2>Ranking</h2>
            </div>
            <Leaderboard rows={leaderboard} />
          </section>
        </div>
      )}

      {isAdmin && (
        <section className="panel admin-panel">
          <div className="section-heading admin-heading">
            <div>
              <ShieldCheck size={20} />
              <h2>Resultados reales</h2>
            </div>
            <span>Visible solo para admin</span>
          </div>
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <>
              <PhaseTabs activePhase={activeAdminPhase} onChange={setActiveAdminPhase} groups={groupedMatches} />
              {adminVisibleGroups.length > 1 && (
                <GroupCarousel
                  groups={adminVisibleGroups}
                  activeTitle={selectedAdminGroupTitle}
                  onChange={setActiveAdminGroupTitle}
                />
              )}
              {selectedAdminGroup && (
                <MatchGroup title={selectedAdminGroup.title} matches={selectedAdminGroup.matches}>
                  {selectedAdminGroup.matches.map((match) => (
                    <ResultRow
                      key={match.id}
                      match={match}
                      onSaveTeams={saveTeams}
                      onSave={saveResult}
                      onFinish={finishMatch}
                      onClear={clearResult}
                    />
                  ))}
                </MatchGroup>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}

function buildGroupStandings(matches: Match[]) {
  const groups = new Map<string, Map<string, GroupStandingRow>>();
  const matchesByGroup = new Map<string, Match[]>();

  function getRow(groupName: string, team: string) {
    const groupRows = groups.get(groupName) ?? new Map<string, GroupStandingRow>();
    groups.set(groupName, groupRows);

    const existing = groupRows.get(team);
    if (existing) return existing;

    const row: GroupStandingRow = {
      team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
    groupRows.set(team, row);
    return row;
  }

  for (const match of matches) {
    if (!match.group_name) continue;
    matchesByGroup.set(match.group_name, [...(matchesByGroup.get(match.group_name) ?? []), match]);

    const home = getRow(match.group_name, match.home_team);
    const away = getRow(match.group_name, match.away_team);

    if (!hasCompleteScore(match)) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.home_score;
    home.goalsAgainst += match.away_score;
    away.goalsFor += match.away_score;
    away.goalsAgainst += match.home_score;

    if (match.home_score > match.away_score) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (match.home_score < match.away_score) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  }

  return Array.from(groups.entries())
    .map(([groupName, rows]) => ({
      groupName,
      rows: rankGroupRows(Array.from(rows.values()), matchesByGroup.get(groupName) ?? []),
    }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName, "es", { numeric: true }));
}

function compareStandingRows(a: GroupStandingRow, b: GroupStandingRow) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.team.localeCompare(b.team, "es");
}

function compareThirdPlaceRows(a: GroupStandingRow, b: GroupStandingRow) {
  return compareStandingRows(a, b);
}

function createEmptyHeadToHeadStats(): HeadToHeadStats {
  return {
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  };
}

function buildHeadToHeadStats(rows: GroupStandingRow[], matches: Match[]) {
  const tiedTeams = new Set(rows.map((row) => row.team));
  const stats = new Map(rows.map((row) => [row.team, createEmptyHeadToHeadStats()]));

  for (const match of matches) {
    if (!hasCompleteScore(match) || !tiedTeams.has(match.home_team) || !tiedTeams.has(match.away_team)) {
      continue;
    }

    const home = stats.get(match.home_team);
    const away = stats.get(match.away_team);
    if (!home || !away) continue;

    home.goalsFor += match.home_score;
    home.goalsAgainst += match.away_score;
    away.goalsFor += match.away_score;
    away.goalsAgainst += match.home_score;

    if (match.home_score > match.away_score) {
      home.points += 3;
    } else if (match.home_score < match.away_score) {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  }

  return stats;
}

function groupRowsByScore(rows: GroupStandingRow[], getScore: (row: GroupStandingRow) => number | string) {
  const buckets = new Map<number | string, GroupStandingRow[]>();
  for (const row of rows) {
    const score = getScore(row);
    buckets.set(score, [...(buckets.get(score) ?? []), row]);
  }
  return buckets;
}

function rankByNumericCriterion(
  rows: GroupStandingRow[],
  getScore: (row: GroupStandingRow) => number,
  rankTie: (tiedRows: GroupStandingRow[]) => GroupStandingRow[],
) {
  const buckets = groupRowsByScore(rows, getScore);
  return Array.from(buckets.entries())
    .sort(([scoreA], [scoreB]) => Number(scoreB) - Number(scoreA))
    .flatMap(([, tiedRows]) => (tiedRows.length === 1 ? tiedRows : rankTie(tiedRows)));
}

function rankByTeamName(rows: GroupStandingRow[]) {
  // FIFA 2026 next uses team conduct and FIFA rankings. This app does not store those values yet,
  // so keep the final fallback deterministic until that data exists.
  return [...rows].sort((a, b) => a.team.localeCompare(b.team, "es"));
}

function rankHeadToHeadRows(rows: GroupStandingRow[], matches: Match[], criterionIndex = 0): GroupStandingRow[] {
  if (rows.length <= 1) return rows;

  const stats = buildHeadToHeadStats(rows, matches);
  const criteria = [
    (row: GroupStandingRow) => stats.get(row.team)?.points ?? 0,
    (row: GroupStandingRow) => stats.get(row.team)?.goalDifference ?? 0,
    (row: GroupStandingRow) => stats.get(row.team)?.goalsFor ?? 0,
  ];

  if (criterionIndex >= criteria.length) {
    return rankByOverallGroupRows(rows);
  }

  return rankByNumericCriterion(rows, criteria[criterionIndex], (tiedRows) =>
    rankHeadToHeadRows(tiedRows, matches, tiedRows.length === rows.length ? criterionIndex + 1 : 0),
  );
}

function rankByOverallGroupRows(rows: GroupStandingRow[], criterionIndex = 0): GroupStandingRow[] {
  if (rows.length <= 1) return rows;

  const criteria = [
    (row: GroupStandingRow) => row.goalDifference,
    (row: GroupStandingRow) => row.goalsFor,
  ];

  if (criterionIndex >= criteria.length) {
    return rankByTeamName(rows);
  }

  return rankByNumericCriterion(rows, criteria[criterionIndex], (tiedRows) =>
    rankByOverallGroupRows(tiedRows, criterionIndex + 1),
  );
}

function rankGroupRows(rows: GroupStandingRow[], matches: Match[]) {
  if (rows.length <= 1) return rows;

  return rankByNumericCriterion(rows, (row) => row.points, (tiedRows) =>
    rankHeadToHeadRows(tiedRows, matches),
  );
}

function getResolvedWinner(match: Match) {
  if (!hasCompleteScore(match)) return null;
  if (match.home_score === match.away_score) return null;
  return match.home_score > match.away_score ? match.home_team : match.away_team;
}

function getResolvedLoser(match: Match) {
  if (!hasCompleteScore(match)) return null;
  if (match.home_score === match.away_score) return null;
  return match.home_score > match.away_score ? match.away_team : match.home_team;
}

function resolveAutomaticTeams(matches: Match[]) {
  const standingsByGroup = new Map(buildGroupStandings(matches).map((group) => [group.groupName, group.rows]));
  const resolvedByNumber = new Map<number, Match>();
  const thirdPlaceCandidates = Array.from(standingsByGroup.entries())
    .map(([groupName, rows]) => ({ groupName, row: rows[2] }))
    .filter((candidate): candidate is { groupName: string; row: GroupStandingRow } => Boolean(candidate.row))
    .sort((a, b) => compareThirdPlaceRows(a.row, b.row))
    .slice(0, 8);
  const thirdPlaceGroupsKey = thirdPlaceCandidates.map((candidate) => candidate.groupName).sort().join("");
  const officialThirdPlaceAssignment = FIFA_THIRD_PLACE_ASSIGNMENTS.get(thirdPlaceGroupsKey);

  function resolveGroupPlaceholder(teamName: string) {
    const match = teamName.match(/^([123])\.º Grupo ([A-L](?:\/[A-L])*)$/);
    if (!match) return teamName;

    const rank = Number(match[1]);
    const candidateGroups = match[2].split("/");

    if (rank === 1 || rank === 2) {
      const groupName = candidateGroups[0];
      return standingsByGroup.get(groupName)?.[rank - 1]?.team ?? teamName;
    }

    if (rank !== 3) {
      return teamName;
    }

    const candidateKey = [...candidateGroups].sort().join("");
    const winnerSlot = THIRD_PLACE_SLOT_BY_CANDIDATES.get(candidateKey);
    const assignedGroup = winnerSlot ? officialThirdPlaceAssignment?.get(winnerSlot) : undefined;
    if (assignedGroup && candidateGroups.includes(assignedGroup)) {
      return standingsByGroup.get(assignedGroup)?.[2]?.team ?? teamName;
    }

    const fallbackThirdPlaceCandidates = candidateGroups
      .map((groupName) => ({ groupName, row: standingsByGroup.get(groupName)?.[2] }))
      .filter((candidate): candidate is { groupName: string; row: GroupStandingRow } =>
        Boolean(candidate.row),
      )
      .sort((a, b) => compareThirdPlaceRows(a.row, b.row));

    const selected = fallbackThirdPlaceCandidates[0];
    if (!selected) return teamName;

    return selected.row.team;
  }

  function resolveMatchReference(teamName: string) {
    const winnerMatch = teamName.match(/^Ganador (\d+)$/);
    if (winnerMatch) {
      const sourceMatch = resolvedByNumber.get(Number(winnerMatch[1]));
      return sourceMatch ? getResolvedWinner(sourceMatch) ?? teamName : teamName;
    }

    const loserMatch = teamName.match(/^Perdedor (\d+)$/);
    if (loserMatch) {
      const sourceMatch = resolvedByNumber.get(Number(loserMatch[1]));
      return sourceMatch ? getResolvedLoser(sourceMatch) ?? teamName : teamName;
    }

    return resolveGroupPlaceholder(teamName);
  }

  const orderedMatches = [...matches].sort((a, b) => {
    const matchNumberA = a.match_number ?? Number.MAX_SAFE_INTEGER;
    const matchNumberB = b.match_number ?? Number.MAX_SAFE_INTEGER;
    if (matchNumberA !== matchNumberB) return matchNumberA - matchNumberB;
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  });

  for (const match of orderedMatches) {
    const resolvedMatch = {
      ...match,
      home_team: resolveMatchReference(match.home_team),
      away_team: resolveMatchReference(match.away_team),
    };
    if (resolvedMatch.match_number !== null) {
      resolvedByNumber.set(resolvedMatch.match_number, resolvedMatch);
    }
  }

  return matches.map((match) =>
    match.match_number === null ? match : resolvedByNumber.get(match.match_number) ?? match,
  );
}

function groupMatchesByStage(matches: Match[]) {
  const groups = new Map<string, Match[]>();

  for (const match of matches) {
    const title = GROUP_STAGE_NAMES.has(match.stage) ? match.stage : match.stage;

    groups.set(title, [...(groups.get(title) ?? []), match]);
  }

  return Array.from(groups.entries())
    .map(([title, groupMatches]) => ({
      title,
      matches: groupMatches.sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    }))
    .sort(
      (a, b) =>
        new Date(a.matches[0].starts_at).getTime() - new Date(b.matches[0].starts_at).getTime(),
    );
}

function toLocalDateKey(timestamp: string | number | Date) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function countMatchesOnLocalDate(matches: Match[], now: number) {
  const todayKey = toLocalDateKey(now);
  return matches.filter((match) => toLocalDateKey(match.starts_at) === todayKey).length;
}

function findCurrentMatchGroup(groups: MatchGroupData[], now: number) {
  const todayKey = toLocalDateKey(now);
  const todaysGroup = groups.find((group) =>
    group.matches.some((match) => toLocalDateKey(match.starts_at) === todayKey),
  );
  if (todaysGroup) return todaysGroup;

  const nextGroup = groups.find((group) =>
    group.matches.some((match) => new Date(match.starts_at).getTime() >= now),
  );
  return nextGroup ?? groups[groups.length - 1];
}

function getPhaseTab(stage: string): PhaseTab {
  if (GROUP_STAGE_NAMES.has(stage)) return "groups";
  if (stage === "Dieciseisavos de final") return "round32";
  if (stage === "Octavos de final") return "round16";
  if (stage === "Cuartos de final") return "quarters";
  if (stage === "Semifinal") return "semis";
  return "finals";
}

function PhaseTabs({
  activePhase,
  onChange,
  groups,
}: {
  activePhase: PhaseTab;
  onChange: (phase: PhaseTab) => void;
  groups: Array<{ title: string; matches: Match[] }>;
}) {
  const groupsByPhase = new Map<PhaseTab, Array<{ title: string; matches: Match[] }>>();
  for (const group of groups) {
    const phase = getPhaseTab(group.title);
    groupsByPhase.set(phase, [...(groupsByPhase.get(phase) ?? []), group]);
  }

  return (
    <div className="phase-tabs" role="tablist" aria-label="Secciones">
      {PHASE_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === activePhase ? "active" : ""}
          disabled={!groupsByPhase.has(tab.id)}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function GroupCarousel({
  groups,
  activeTitle,
  onChange,
}: {
  groups: Array<{ title: string; matches: Match[] }>;
  activeTitle: string;
  onChange: (title: string) => void;
}) {
  const activeIndex = Math.max(0, groups.findIndex((group) => group.title === activeTitle));
  const activeGroup = groups[activeIndex] ?? groups[0];

  function goTo(index: number) {
    const nextGroup = groups[Math.min(Math.max(index, 0), groups.length - 1)];
    if (nextGroup) onChange(nextGroup.title);
  }

  return (
    <section className="group-carousel" aria-label="Jornadas">
      <button
        type="button"
        className="icon-button secondary"
        disabled={activeIndex === 0}
        onClick={() => goTo(activeIndex - 1)}
        aria-label="Jornada anterior"
        title="Jornada anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="carousel-current">
        <strong>{activeGroup.title}</strong>
        <span>
          {activeIndex + 1} de {groups.length}
        </span>
      </div>
      <button
        type="button"
        className="icon-button secondary"
        disabled={activeIndex === groups.length - 1}
        onClick={() => goTo(activeIndex + 1)}
        aria-label="Jornada siguiente"
        title="Jornada siguiente"
      >
        <ChevronRight size={18} />
      </button>
    </section>
  );
}

function MatchGroup({
  title,
  matches,
  children,
}: {
  title: string;
  matches: Match[];
  children: ReactNode;
}) {
  const completed = matches.filter((match) => match.status === "finished").length;
  const firstDate = new Date(matches[0].starts_at).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
  });
  const lastDate = new Date(matches[matches.length - 1].starts_at).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
  });
  const dateRange = firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`;

  return (
    <section className="match-group">
      <header className="match-group-header">
        <div>
          <h3>{title}</h3>
          <span>{dateRange}</span>
        </div>
        <strong>
          {completed}/{matches.length}
        </strong>
      </header>
      <div className="match-list">{children}</div>
    </section>
  );
}

function LoginScreen({
  loading,
  message,
  onLogin,
}: {
  loading: boolean;
  message: string;
  onLogin: (name: string, pin: string) => void;
}) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onLogin(name, pin);
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <p className="eyebrow">Quiniela Mundial</p>
        <h1>Pronósticos del equipo</h1>
        <form onSubmit={submit}>
          <label>
            Alias
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" />
          </label>
          <label>
            PIN
            <input value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Cualquier PIN que recuerdes" />
          </label>
          <button type="submit" disabled={loading}>
            Entrar
          </button>
        </form>
        {message && <div className="notice">{message}</div>}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScoringRules() {
  return (
    <div className="scoring-rules" aria-label="Reglas de puntaje">
      <strong>Reglas de puntaje</strong>
      <div>
        {SCORING_RULES.map((rule) => (
          <span key={rule.label}>
            <b>{rule.points}</b> {rule.points === 1 ? "pto" : "pts"} · {rule.label}: {rule.description}
          </span>
        ))}
      </div>
      <small>Si aciertas el marcador exacto recibes 5 pts totales; no se suman puntos extra por resultado o goles.</small>
    </div>
  );
}

function PredictionRow({
  match,
  now,
  prediction,
  onSave,
}: {
  match: Match;
  now: number;
  prediction?: Prediction;
  onSave: (matchId: string, homeScore: number, awayScore: number) => Promise<boolean>;
}) {
  const [homeScore, setHomeScore] = useState<ScoreInput>(prediction?.home_score ?? "");
  const [awayScore, setAwayScore] = useState<ScoreInput>(prediction?.away_score ?? "");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ homeScore: number; awayScore: number } | null>(null);
  const savedHomeScore = prediction?.home_score;
  const savedAwayScore = prediction?.away_score;
  const effectiveSavedHomeScore = pendingSave?.homeScore ?? savedHomeScore;
  const effectiveSavedAwayScore = pendingSave?.awayScore ?? savedAwayScore;
  const locked = isMatchLocked(match, now);
  const score = describePredictionScore(match, prediction);
  const canSave = homeScore !== "" && awayScore !== "";

  useEffect(() => {
    if (!hasUserEdited && !pendingSave) {
      setHomeScore(prediction?.home_score ?? "");
      setAwayScore(prediction?.away_score ?? "");
    }
  }, [hasUserEdited, pendingSave, prediction?.away_score, prediction?.home_score]);

  useEffect(() => {
    if (
      pendingSave &&
      prediction?.home_score === pendingSave.homeScore &&
      prediction?.away_score === pendingSave.awayScore
    ) {
      setPendingSave(null);
    }
  }, [pendingSave, prediction?.away_score, prediction?.home_score]);

  useEffect(() => {
    if (!hasUserEdited || locked || !canSave) return;
    if (homeScore === effectiveSavedHomeScore && awayScore === effectiveSavedAwayScore) return;

    const timeoutId = window.setTimeout(() => {
      saveScores(homeScore, awayScore);
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    awayScore,
    canSave,
    effectiveSavedAwayScore,
    effectiveSavedHomeScore,
    hasUserEdited,
    homeScore,
    locked,
    match.id,
  ]);

  function saveScores(nextHomeScore: number, nextAwayScore: number) {
    if (locked) {
      setHasUserEdited(false);
      return;
    }

    if (nextHomeScore === effectiveSavedHomeScore && nextAwayScore === effectiveSavedAwayScore) {
      setHasUserEdited(false);
      return;
    }

    setPendingSave({ homeScore: nextHomeScore, awayScore: nextAwayScore });
    setHasUserEdited(false);
    void onSave(match.id, nextHomeScore, nextAwayScore).then((saved) => {
      if (!saved) setPendingSave(null);
    });
  }

  function saveNow() {
    if (homeScore === "" || awayScore === "") return;
    saveScores(homeScore, awayScore);
  }

  return (
    <article className={locked ? "match-row locked" : "match-row"}>
      <div className="match-info">
        <span>
          {match.match_number ? `Partido ${match.match_number} · ` : ""}
          {match.group_name ? `Grupo ${match.group_name}` : match.stage}
        </span>
        <strong className="match-teams">
          <TeamName name={match.home_team} />
          <span>vs</span>
          <TeamName name={match.away_team} />
        </strong>
        <small>
          {new Date(match.starts_at).toLocaleString("es-CR")}
          {match.venue ? ` · ${match.venue}` : ""}
          {locked ? " · Cerrado" : ""}
        </small>
        {hasCompleteScore(match) && (
          <div className="official-score">
            <span>{match.status === "finished" ? "Final" : "Preliminar"}</span>
            <strong>
              {match.home_score} - {match.away_score}
            </strong>
          </div>
        )}
      </div>
      <div className="score-editor">
        <input
          type="number"
          min="0"
          max={MAX_SCORE}
          value={homeScore}
          disabled={locked}
          placeholder="Local"
          onChange={(event) => {
            setHasUserEdited(true);
            setHomeScore(readScoreInput(event.target.value));
          }}
          onBlur={saveNow}
          aria-label={`Goles de ${match.home_team}`}
        />
        <span>-</span>
        <input
          type="number"
          min="0"
          max={MAX_SCORE}
          value={awayScore}
          disabled={locked}
          placeholder="Visita"
          onChange={(event) => {
            setHasUserEdited(true);
            setAwayScore(readScoreInput(event.target.value));
          }}
          onBlur={saveNow}
          aria-label={`Goles de ${match.away_team}`}
        />
      </div>
      {hasCompleteScore(match) && (
        <div className="points-breakdown">
          <span className="points">{score.points} pts</span>
          <small>{score.details.join(" ")}</small>
        </div>
      )}
    </article>
  );
}

function ResultRow({
  match,
  onSaveTeams,
  onSave,
  onFinish,
  onClear,
}: {
  match: Match;
  onSaveTeams: (matchId: string, homeTeam: string, awayTeam: string) => void;
  onSave: (matchId: string, homeScore: number, awayScore: number) => void;
  onFinish: (matchId: string) => void;
  onClear: (matchId: string) => void;
}) {
  const [homeTeam, setHomeTeam] = useState(match.home_team);
  const [awayTeam, setAwayTeam] = useState(match.away_team);
  const [homeScore, setHomeScore] = useState<ScoreInput>(match.home_score ?? "");
  const [awayScore, setAwayScore] = useState<ScoreInput>(match.away_score ?? "");
  const isFinished = match.status === "finished";
  const canEditTeams = !GROUP_STAGE_NAMES.has(match.stage);
  const canSave = homeScore !== "" && awayScore !== "";
  const canSaveTeams = homeTeam.trim() !== "" && awayTeam.trim() !== "";

  useEffect(() => {
    setHomeTeam(match.home_team);
    setAwayTeam(match.away_team);
  }, [match.away_team, match.home_team]);

  useEffect(() => {
    setHomeScore(match.home_score ?? "");
    setAwayScore(match.away_score ?? "");
  }, [match.away_score, match.home_score]);

  return (
    <article className={isFinished ? "match-row result-row finished" : "match-row result-row"}>
      <div className="match-info">
        <span>
          {match.match_number ? `Partido ${match.match_number} · ` : ""}
          {match.group_name ? `Grupo ${match.group_name}` : match.stage}
        </span>
        <strong className="match-teams">
          <TeamName name={match.home_team} />
          <span>vs</span>
          <TeamName name={match.away_team} />
        </strong>
        <small>
          {new Date(match.starts_at).toLocaleString("es-CR")}
          {match.venue ? ` · ${match.venue}` : ""}
        </small>
      </div>
      <div className="admin-match-controls">
        {canEditTeams && (
          <div className="team-editor">
            <input
              value={homeTeam}
              onChange={(event) => setHomeTeam(event.target.value)}
              aria-label="Equipo local"
            />
            <span>vs</span>
            <input
              value={awayTeam}
              onChange={(event) => setAwayTeam(event.target.value)}
              aria-label="Equipo visitante"
            />
            <button
              className="icon-button"
              disabled={!canSaveTeams}
              onClick={() => onSaveTeams(match.id, homeTeam, awayTeam)}
              aria-label="Guardar equipos"
              title="Guardar equipos"
            >
              <Save size={18} />
            </button>
          </div>
        )}
        <div className="score-editor result-editor">
          <input
            type="number"
            min="0"
            max={MAX_SCORE}
            value={homeScore}
            placeholder="Local"
            onChange={(event) => setHomeScore(readScoreInput(event.target.value))}
            aria-label={`Resultado real de ${match.home_team}`}
          />
          <span>-</span>
          <input
            type="number"
            min="0"
            max={MAX_SCORE}
            value={awayScore}
            placeholder="Visita"
            onChange={(event) => setAwayScore(readScoreInput(event.target.value))}
            aria-label={`Resultado real de ${match.away_team}`}
          />
          <button
            className="icon-button"
            disabled={!canSave}
            onClick={() => {
              if (homeScore !== "" && awayScore !== "") onSave(match.id, homeScore, awayScore);
            }}
            aria-label="Guardar resultado real"
            title="Guardar resultado real"
          >
            <Save size={18} />
          </button>
          {!isFinished && (
            <button
              className="icon-button finish"
              disabled={!canSave}
              onClick={() => {
                if (homeScore !== "" && awayScore !== "") onFinish(match.id);
              }}
              aria-label="Marcar partido como finalizado"
              title="Marcar partido como finalizado"
            >
              <CheckCircle2 size={18} />
            </button>
          )}
          {(isFinished || match.home_score !== null || match.away_score !== null) && (
            <button
              className="icon-button danger"
              onClick={() => onClear(match.id)}
              aria-label="Quitar marcador y reabrir"
              title="Quitar marcador y reabrir"
            >
              <RotateCcw size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="result-status">
        <span>{isFinished ? "Finalizado" : "Pendiente"}</span>
        {isFinished && (
          <strong>
            {match.home_score} - {match.away_score}
          </strong>
        )}
      </div>
    </article>
  );
}

function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const visibleRows = rows.filter((row) => !isAdminParticipant(row.participant));

  return (
    <div className="leaderboard">
      {visibleRows.map((row, index) => {
        const exactPoints = row.exactHits * 5;
        const resultPoints = row.resultOnlyHits * 3;

        return (
          <div className="leaderboard-row" key={row.participant.id}>
            <strong>#{index + 1}</strong>
            <span>{row.participant.name}</span>
            <b>{row.points} pts</b>
            <small>
              {row.points} pts = {row.exactHits} exactos ({exactPoints}) + {row.resultOnlyHits} resultados (
              {resultPoints}) + {row.goalBonusHits} goles ({row.goalBonusHits}).
            </small>
            <small className="leaderboard-context">
              Puntúan {row.scoredPredictions} de {row.predictions} pronósticos guardados con marcador cargado.
              Desempate: exactos, luego resultados.
            </small>
          </div>
        );
      })}
    </div>
  );
}

function KnockoutBracket({ matches }: { matches: Match[] }) {
  const matchesByNumber = new Map(
    matches
      .filter((match): match is Match & { match_number: number } => match.match_number !== null)
      .map((match) => [match.match_number, match]),
  );
  const buildSide = (side: typeof BRACKET_SIDES.left | typeof BRACKET_SIDES.right) =>
    side.map((round) => ({
      ...round,
      matches: round.matchNumbers.reduce<Match[]>((roundMatches, matchNumber) => {
        const match = matchesByNumber.get(matchNumber);
        if (match) roundMatches.push(match);
        return roundMatches;
      }, []),
    }));
  const leftRounds = buildSide(BRACKET_SIDES.left);
  const rightRounds = buildSide(BRACKET_SIDES.right);
  const finalMatch = matchesByNumber.get(FINAL_MATCH_NUMBER);
  const thirdPlaceMatch = matchesByNumber.get(THIRD_PLACE_MATCH_NUMBER);
  const hasBracketMatches =
    leftRounds.some((round) => round.matches.length > 0) ||
    rightRounds.some((round) => round.matches.length > 0) ||
    finalMatch ||
    thirdPlaceMatch;

  if (!hasBracketMatches) return null;

  function renderRound(round: (typeof leftRounds | typeof rightRounds)[number], side: "left" | "right") {
    return (
      <div className={`bracket-column bracket-column-${side}`} key={round.id}>
        <div className="bracket-lanes">
          {round.matches.map((match, index) => {
            const laneSpan = 16 / round.matchNumbers.length;
            return (
              <div
                className={`bracket-slot bracket-slot-${side}`}
                key={match.id}
                style={{ gridRow: `${index * laneSpan + 1} / span ${laneSpan}` }}
              >
                <BracketMatchCard match={match} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="knockout-bracket" aria-label="Llaves de eliminación">
      <div className="bracket-scroll">
        <div className="bracket-stage-headings">
          {BRACKET_STAGE_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="bracket-board">
          {leftRounds.map((round) => renderRound(round, "left"))}
          <div className="bracket-center">
            <div className="bracket-lanes bracket-lanes-center">
              {finalMatch && (
                <div className="bracket-slot bracket-slot-center" style={{ gridRow: "5 / span 6" }}>
                  <BracketMatchCard match={finalMatch} featured />
                </div>
              )}
              {thirdPlaceMatch && (
                <div className="bracket-slot bracket-slot-center bracket-slot-third" style={{ gridRow: "12 / span 4" }}>
                  <BracketMatchCard match={thirdPlaceMatch} />
                </div>
              )}
            </div>
          </div>
          {rightRounds.map((round) => renderRound(round, "right"))}
        </div>
      </div>
    </section>
  );
}

function BracketMatchCard({ match, featured = false }: { match: Match; featured?: boolean }) {
  const winner = getResolvedWinner(match);
  const hasScore = hasCompleteScore(match);

  return (
    <article className={featured ? "bracket-match featured" : "bracket-match"}>
      <span>{match.match_number ? `P${match.match_number}` : match.stage}</span>
      <div className={winner === match.home_team ? "bracket-team winner" : "bracket-team"}>
        <TeamName name={match.home_team} />
        {hasScore && <b>{match.home_score}</b>}
      </div>
      <div className={winner === match.away_team ? "bracket-team winner" : "bracket-team"}>
        <TeamName name={match.away_team} />
        {hasScore && <b>{match.away_score}</b>}
      </div>
    </article>
  );
}

function GroupStandings({
  groups,
}: {
  groups: Array<{ groupName: string; rows: GroupStandingRow[] }>;
}) {
  if (groups.length === 0) {
    return <p>No hay grupos disponibles.</p>;
  }

  return (
    <div className="standings-grid">
      {groups.map((group) => (
        <section className="standings-card" key={group.groupName}>
          <header>
            <h3>Grupo {group.groupName}</h3>
          </header>
          <div className="standings-table" role="table" aria-label={`Posiciones del grupo ${group.groupName}`}>
            <div className="standings-row standings-head" role="row">
              <span>#</span>
              <span>Equipo</span>
              <span>PJ</span>
              <span>G</span>
              <span>E</span>
              <span>P</span>
              <span>DG</span>
              <span>Pts</span>
            </div>
            {group.rows.map((row, index) => (
              <div className="standings-row" role="row" key={row.team}>
                <span>{index + 1}</span>
                <strong>
                  <TeamName name={row.team} />
                </strong>
                <span>{row.played}</span>
                <span>{row.wins}</span>
                <span>{row.draws}</span>
                <span>{row.losses}</span>
                <span>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</span>
                <b>{row.points}</b>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
