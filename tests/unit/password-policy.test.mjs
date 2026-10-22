import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { localPasswordError, isLeakedPassword, passwordError } from "../../src/password-policy.js";

test("refuse moins de 12 caractères", () => {
  assert.match(localPasswordError("Abc123!"), /12 caractères/);
  assert.equal(localPasswordError("Un-bon-mot-de-passe-42"), null);
});

test("refuse les mots de passe courants ou répétitifs", () => {
  assert.ok(localPasswordError("password1234"));
  assert.ok(localPasswordError("Mot de passe!!"), "variante avec ponctuation de « motdepasse »");
  assert.ok(localPasswordError("aaaaaaaaaaaaaa"));
});

test("détecte un mot de passe présent dans une fuite (sans l'envoyer en clair)", async () => {
  const pw = "Un-mot-de-passe-fuite-77";
  const sha = createHash("sha1").update(pw).digest("hex").toUpperCase();
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(`0000000000000000000000000000000000A:3\n${sha.slice(5)}:42\n`);
  };
  assert.equal(await isLeakedPassword(pw), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], "https://api.pwnedpasswords.com/range/" + sha.slice(0, 5), "seuls 5 caractères de l'empreinte sont envoyés");
  assert.ok(!calls[0].includes(pw));
  assert.match(await passwordError(pw), /fuite/);
});

test("mot de passe absent des fuites, ou service en panne : accepté", async () => {
  globalThis.fetch = async () => new Response("0000000000000000000000000000000000A:3\n");
  assert.equal(await passwordError("Un-autre-mot-de-passe-91"), null);
  globalThis.fetch = async () => { throw new Error("réseau"); };
  assert.equal(await passwordError("Un-autre-mot-de-passe-91"), null);
});
