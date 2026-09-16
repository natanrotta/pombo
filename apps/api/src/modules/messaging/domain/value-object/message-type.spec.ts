import { MESSAGE_TYPES, type MessageType } from "@pombo/shared-types";
import { outbox_message_type } from "@generated/prisma/enums";
import { RICH_MESSAGE_TYPES } from "./message-type";

describe("MessageType wire contract", () => {
  it("matches the Prisma outbox_message_type enum", () => {
    expect([...MESSAGE_TYPES].sort()).toEqual(
      Object.values(outbox_message_type).sort(),
    );
    expectTypeOf<MessageType>().toEqualTypeOf<outbox_message_type>();
  });

  it("treats every non-text kind as a rich message", () => {
    expect([...RICH_MESSAGE_TYPES].sort()).toEqual(
      MESSAGE_TYPES.filter((type) => type !== "text").sort(),
    );
  });
});
