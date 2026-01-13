import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { config } from '../config';

dotenv.config();

async function run() {
    try {
        const url = process.env.DATABASE_URL || config.DATABASE_URL;
        if (!url) {
            console.error('DATABASE_URL is missing');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(url);
        console.log('Connected.');

        const connection = mongoose.connection;
        const db = connection.db;

        if (!db) {
            throw new Error('Database connection not established');
        }

        const collection = db.collection('projects');

        console.log('Fetching indexes...');
        const indexes = await collection.indexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        const userIdIndex = indexes.find(idx => idx.name === 'userId_1');
        if (userIdIndex) {
            console.log('Found problematic index userId_1. Dropping it...');
            await collection.dropIndex('userId_1');
            console.log('Index userId_1 dropped successfully.');
        } else {
            console.log('Index userId_1 not found.');
        }

        // Also check for user_id_1 just in case
        const userIdIndex2 = indexes.find(idx => idx.name === 'user_id_1');
        if (userIdIndex2) {
            console.log('Found problematic index user_id_1. Dropping it...');
            await collection.dropIndex('user_id_1');
            console.log('Index user_id_1 dropped successfully.');
        }

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

run();
