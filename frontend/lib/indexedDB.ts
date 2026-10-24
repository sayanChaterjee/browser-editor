import { openDB, IDBPDatabase, DBSchema } from 'idb';

const DB_NAME = 'ProjectDatabase';
const STORE_NAME = 'projects';
const VERSION = 2;

export interface LocalProject {
    id: string;
    userId: string;
    name: string;
    html: string;
    css: string;
    js: string;
    updatedAt: string;
    isSynced: boolean;
}

interface ProjectDB extends DBSchema {
    projects: {
        key: string;
        value: LocalProject;
    };
}

let dbPromise: Promise<IDBPDatabase<ProjectDB>> | null = null;

const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<ProjectDB>(DB_NAME, VERSION, {
            upgrade(db, oldVersion, newVersion) {
                console.log(`Upgrading IDB from ${oldVersion} to ${newVersion}`);
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
};

export const saveLocalProject = async (project: LocalProject) => {
    const db = await getDB();
    await db.put(STORE_NAME, project);
};

export const getLocalProject = async (id: string, userId: string): Promise<LocalProject | undefined> => {
    const db = await getDB();
    const project = await db.get(STORE_NAME, id);
    if (project && project.userId === userId) {
        return project;
    }
    return undefined;
};

export const getAllLocalProjects = async (userId: string): Promise<LocalProject[]> => {
    const db = await getDB();
    const allProjects = await db.getAll(STORE_NAME);
    return allProjects.filter((p: LocalProject) => p.userId === userId);
};

export const deleteLocalProject = async (id: string) => {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
};

export const clearLocalProjects = async () => {
    const db = await getDB();
    await db.clear(STORE_NAME);
};

export const clearMismatchingProjects = async (userId: string) => {
    const db = await getDB();
    const all = await db.getAll(STORE_NAME);
    const toDelete = all.filter((p: LocalProject) => p.userId !== userId);
    for (const p of toDelete) {
        await db.delete(STORE_NAME, p.id);
    }
    if (toDelete.length > 0) {
        console.log(`Cleared ${toDelete.length} mismatching local projects`);
    }
};
