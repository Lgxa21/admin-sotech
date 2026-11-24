import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safePath, isUuid, pick } from "./form";
import { parseAmount, parseRate, toUsd } from "./money";
import { canMoveTo, canTransition } from "./order-workflow";
import { rateLimit } from "./rate-limit";

describe("safePath", () => {
  it("acepta rutas relativas", () => {
    assert.equal(safePath("/finanzas/cobros", "/"), "/finanzas/cobros");
    assert.equal(safePath("/ordenes/1#dinero", "/"), "/ordenes/1#dinero");
  });
  it("bloquea open redirects", () => {
    assert.equal(safePath("//evil.com", "/ok"), "/ok");
    assert.equal(safePath("https://evil.com", "/ok"), "/ok");
    assert.equal(safePath(null, "/ok"), "/ok");
  });
});

describe("isUuid", () => {
  it("valida UUID", () => {
    assert.equal(isUuid("550e8400-e29b-41d4-a716-446655440000"), true);
    assert.equal(isUuid("no-uuid"), false);
  });
});

describe("pick", () => {
  it("elige de la lista o fallback", () => {
    const list = ["A", "B"] as const;
    assert.equal(pick(list, "B", "A"), "B");
    assert.equal(pick(list, "Z", "A"), "A");
  });
});

describe("money", () => {
  it("parsea montos VE y US", () => {
    assert.equal(parseAmount("1.234,56"), 1234.56);
    assert.equal(parseAmount("1234.56"), 1234.56);
    assert.equal(parseRate("215,40"), 215.4);
  });
  it("convierte VES a USD", () => {
    assert.equal(toUsd(2154, "VES", 215.4), 10);
    assert.equal(toUsd(10, "USD", null), 10);
  });
});

describe("canMoveTo", () => {
  it("bloquea freelancers", () => {
    assert.equal(canMoveTo({ role: "FREELANCER" }, "EN_PRODUCCION"), false);
  });
  it("solo dirección envía al cliente", () => {
    assert.equal(canMoveTo({ role: "DIRECCION" }, "ENVIADO_CLIENTE"), true);
    assert.equal(canMoveTo({ role: "ADMINISTRACION" }, "ENVIADO_CLIENTE"), false);
    assert.equal(canMoveTo({ role: "PRODUCCION" }, "ENVIADO_CLIENTE"), false);
  });
  it("cierre solo manage", () => {
    assert.equal(canMoveTo({ role: "PRODUCCION" }, "FACTURADO"), false);
    assert.equal(canMoveTo({ role: "ADMINISTRACION" }, "FACTURADO"), true);
  });
});

describe("rateLimit", () => {
  it("corta tras el límite", () => {
    const key = `test-${Date.now()}`;
    assert.equal(rateLimit(key, 2, 60_000).ok, true);
    assert.equal(rateLimit(key, 2, 60_000).ok, true);
    assert.equal(rateLimit(key, 2, 60_000).ok, false);
  });
});

describe("canTransition", () => {
  it("permite avanzar un paso y devolver un trabajo desde revisión interna", () => {
    assert.equal(canTransition({ role: "PRODUCCION" }, "RECIBIDO", "BRIEF_REVISION"), true);
    assert.equal(canTransition({ role: "PRODUCCION" }, "REVISION_INTERNA", "EN_PRODUCCION"), true);
  });

  it("exige autorización y motivo para saltar etapas", () => {
    assert.equal(canTransition({ role: "PRODUCCION" }, "RECIBIDO", "APROBADO", "Solicitud interna"), false);
    assert.equal(canTransition({ role: "ADMINISTRACION" }, "RECIBIDO", "FACTURADO", "  "), false);
    assert.equal(canTransition({ role: "ADMINISTRACION" }, "RECIBIDO", "FACTURADO", "Trabajo previo al piloto"), true);
  });

  it("reserva el envío al cliente a Dirección incluso con un motivo", () => {
    assert.equal(canTransition({ role: "ADMINISTRACION" }, "REVISION_INTERNA", "ENVIADO_CLIENTE", "Por solicitud"), false);
    assert.equal(canTransition({ role: "DIRECCION" }, "REVISION_INTERNA", "ENVIADO_CLIENTE"), true);
  });
});
