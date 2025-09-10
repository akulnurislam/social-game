import type { Group, GroupMember } from "./group";
import type { GroupRepository } from "./group.repository";

export class GroupService {
  constructor(private repo: GroupRepository) { }

  async createGroup(name: string, ownerId: string): Promise<Group | null> {
    if (!name || name.length < 3) {
      throw new Error('Group name must be at least 3 characters');
    }
    return this.repo.create(name, ownerId);
  }

  async listGroups(limit = 20, offset = 0): Promise<Group[]> {
    return this.repo.findAll(limit, offset);
  }

  async getGroupById(id: string): Promise<Group | null> {
    return this.repo.findById(id);
  }

  async listMembers(groupId: string): Promise<GroupMember[]> {
    return this.repo.listMembers(groupId);
  }

  async joinGroup(groupId: string, playerId: string) {
    // Validate group exists
    const group = await this.repo.findById(groupId);
    if (!group) throw new Error('Group not found');

    await this.repo.joinGroup(groupId, playerId);
    return { message: 'Joined group successfully' };
  }

  async leaveGroup(groupId: string, playerId: string) {
    // Validate group exists
    const group = await this.repo.findById(groupId);
    if (!group) throw new Error('Group not found');

    await this.repo.leaveGroup(groupId, playerId);
    return { message: 'Left group successfully' };
  }
}
