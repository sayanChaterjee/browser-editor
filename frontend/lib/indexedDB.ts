import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'ProjectDatabase';
const STORE_NAME = 'projects';
const VERSION = 1;

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

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, VERSION, {
            upgrade(db) {
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
