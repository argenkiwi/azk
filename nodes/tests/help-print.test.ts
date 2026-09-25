import { assert, assertEquals } from "@std/assert";
import { factory, State, Utils } from "../help-print.ts";
import { GENERAL, VERB_GUIDES } from "../../utils/help.ts";

function capture(): [Utils, string[]] {
  const printed: string[] = [];
  return [{ print: (msg) => printed.push(msg) }, printed];
}

Deno.test("azkHelpPrintNode should print the general guide", async () => {
  const initialState: State = { topic: "general" };
  const [utils, printed] = capture();

  const result = await factory({ onPrinted: "done" }, utils)(initialState);

  assertEquals(result[0], "done");
  assertEquals(printed, [GENERAL]);
});

Deno.test("azkHelpPrintNode should print a verb's guide", async () => {
  const initialState: State = { topic: "update" };
  const [utils, printed] = capture();

  await factory({ onPrinted: "done" }, utils)(initialState);

  assertEquals(printed, [VERB_GUIDES.update]);
});

Deno.test("every verb guide should show how to invoke its verb", () => {
  for (const [verb, guide] of Object.entries(VERB_GUIDES)) {
    assert(guide.includes(`azk ${verb}`), `${verb} guide lacks "azk ${verb}"`);
  }
});

Deno.test("the general guide should list every verb that has a guide", () => {
  for (const verb of Object.keys(VERB_GUIDES)) {
    assert(GENERAL.includes(`azk ${verb}`), `general guide lacks "${verb}"`);
  }
});
