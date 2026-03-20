// @ts-nocheck — users sub-router (HIGH-11)
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { memberProcedure } from "./_shared";
import * as usersDb from "../db/users";
import { invalidateUserCache } from "../_core/userCache";

export const usersRouter = router({
  list: adminProcedure.query(async () => {
    return await usersDb.getAllUsers();
  }),
  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await usersDb.getUserById(input.id);
    }),
  create: adminProcedure
    .input(
      z.object({
        openId: z.string(),
        name: z.string(),
        email: z.string().email(),
        role: z.enum(["admin", "manager", "technician", "user"]),
        siteId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await usersDb.upsertUser({
        openId: input.openId,
        name: input.name,
        email: input.email,
        role: input.role,
        lastSignedIn: new Date(),
      });
      return { success: true };
    }),
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "manager", "technician", "user"]).optional(),
        siteId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const result = await usersDb.updateUser(id, data);
      const sub = await usersDb.getSupabaseUserIdByAppId(id);
      await invalidateUserCache(sub ?? undefined);
      return result;
    }),
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["admin", "manager", "technician", "user"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot change your own role",
        });
      }
      const updated = await usersDb.updateUserRole(input.userId, input.role);
      await invalidateUserCache(updated?.supabaseUserId ?? undefined);
      return updated;
    }),
  completeOnboarding: memberProcedure.mutation(async ({ ctx }) => {
    await usersDb.updateUser(ctx.user.id, { hasCompletedOnboarding: true });
    await invalidateUserCache(ctx.user.supabaseUserId ?? undefined);
    return { success: true };
  }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await usersDb.deleteUser(input.id);
    }),
  getPendingUsers: adminProcedure.query(async () => {
    return await usersDb.getPendingUsers();
  }),
  approveUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const result = await usersDb.approveUser(input.userId, ctx.user.id);
      const sub = await usersDb.getSupabaseUserIdByAppId(input.userId);
      await invalidateUserCache(sub ?? undefined);
      return result;
    }),
  rejectUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await usersDb.rejectUser(input.userId, input.reason);
      const sub = await usersDb.getSupabaseUserIdByAppId(input.userId);
      await invalidateUserCache(sub ?? undefined);
      return result;
    }),
  bulkApproveUsers: adminProcedure
    .input(z.object({ userIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      const result = await usersDb.bulkApproveUsers(input.userIds, ctx.user.id);
      for (const userId of input.userIds) {
        const sub = await usersDb.getSupabaseUserIdByAppId(userId);
        await invalidateUserCache(sub ?? undefined);
      }
      return result;
    }),
  bulkRejectUsers: adminProcedure
    .input(
      z.object({
        userIds: z.array(z.number()),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await usersDb.bulkRejectUsers(input.userIds, input.reason);
      for (const userId of input.userIds) {
        const sub = await usersDb.getSupabaseUserIdByAppId(userId);
        await invalidateUserCache(sub ?? undefined);
      }
      return result;
    }),
});
