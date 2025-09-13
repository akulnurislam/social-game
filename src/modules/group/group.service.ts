import { AppException } from '../../exceptions/app-exception';
import { GroupNotFoundException } from '../../exceptions/group-not-found-exception';
import type { Group, GroupMember } from './group';
import type { GroupRepository } from './group.repository';

export class GroupService {
  constructor(private readonly repo: GroupRepository) { }

  async createGroup(name: string, ownerId: string): Promise<Group | null> {
    if (!name || name.length < 3) {
      throw new AppException('Group name must be at least 3 characters', 400);
    }

    return this.repo.create(name, ownerId);
  }

  async listGroups(limit = 20, offset = 0): Promise<Group[]> {
    return this.repo.findAll(limit, offset);
  }

  async getGroupById(id: string): Promise<Group> {
    const group = await this.repo.findById(id);
    if (!group) {
      throw new GroupNotFoundException(id);
    }

    return group;
  }

  async listMembers(groupId: string): Promise<GroupMember[]> {
    const group = await this.getGroupById(groupId);
    return this.repo.listMembers(group.id);
  }

  async joinGroup(groupId: string, playerId: string) {
    const group = await this.getGroupById(groupId);
    await this.repo.joinGroup(group.id, playerId);
    return { message: 'Joined group successfully' };
  }

  async leaveGroup(groupId: string, playerId: string) {
    const group = await this.getGroupById(groupId);
    await this.repo.leaveGroup(group.id, playerId);
    return { message: 'Left group successfully' };
  }
}
