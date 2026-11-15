import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'user_database',
    port: 3306
});

const typeDefs = `#graphql
type User {
    id: ID!
    username: String!
}

type Product {
    id: ID!
    productDisplayName: String
}

input UserInput {
    username: String!
    password: String!
    first_name: String
    last_name: String
    phone_number: String
    email: String
    birth_date: String
    gender: String
    country: String
    address_line1: String
    address_line2: String
    zip_code: String
}

type Query {
    _empty: String
    getProducts(
        id: ID,
        gender: [String],
        masterCategory: String,
        subCategory: String,
        baseColour: String,
        season: String,
        year: String,
        usageType: String,
        searchTerm: String,
        productDisplayName: String,
        minPrice: Float,
        maxPrice: Float,
        sortOrder: String,
        offset: Int,
        limit: Int
    ): [Product]

    getUserFavorites(userId: ID!): [Product]
    getUserCart(userId: ID!): [Product]

    logUser(username: String!, password: String!): User
}

type Mutation {
    addUser(input: UserInput!): User
    toggleFavorite(userId: ID!, productId: ID!): Boolean
    toggleCart(userId: ID!, productId: ID!): Boolean
}
`;

const resolvers = {
    Query: {
        _empty: () => 'Serwer działa poprawnie',
        logUser: async (_, { username, password }) => {
            try {
                const [rows]: any = await pool.execute(
                    'SELECT * FROM users WHERE login = ? AND password = ?',
                    [username, password]
                );

                if (rows.length === 0) {
                    throw new Error("Nieprawidłowy login lub hasło");
                }

                return {
                    id: rows[0].id.toString(),
                    username: rows[0].login
                };
            } catch (error) {
                console.error("Błąd logowania:", error);
                throw new Error("Nie udało się zalogować");
            }
        },
        getUserFavorites: async (_, { userId }) => {
            const [rows]: any = await pool.execute(
                'SELECT p.* FROM products p JOIN favorites f ON p.id = f.product_id WHERE f.user_id = ?',
                [userId]
            );
            return rows;
        },
        getUserCart: async (_, { userId }) => {
            const [rows]: any = await pool.execute(
                'SELECT p.* FROM products p JOIN cart c ON p.id = c.product_id WHERE c.user_id = ?',
                [userId]
            );
            return rows;
        },
        getProducts: async (_, args) => {
            try {
                let sql = 'SELECT * FROM products WHERE 1=1';
                const params: any[] = [];

                if(args.id) {
                    sql += ' AND ID = ?'
                    params.push(args.id);
                }

                if(args.gender) {
                    const placeholders = args.gender.map(() => '?').join(',');
                    sql += ` AND gender IN (${placeholders})`;
                    params.push(...args.gender);
                }

                if(args.masterCategory) {
                    sql += ' AND masterCategory = ?'
                    params.push(args.masterCategory);
                }

                if(args.subCategory) {
                    sql += ' AND subCategory = ?'
                    params.push(args.subCategory);
                }

                if(args.baseColour) {
                    sql += ' AND baseColour = ?'
                    params.push(args.baseColour);
                }

                if(args.season) {
                    sql += ' AND season = ?'
                    params.push(args.season)
                }

                if(args.year) {
                    sql += ' AND year = ?'
                    params.push(args.year)
                }

                if(args.usageType) {
                    sql += ' AND usageType = ?'
                    params.push(args.usageType)
                }

                if(args.searchTerm) {
                    sql += ' AND (productDisplayName LIKE ? OR baseColour LIKE ? OR masterCategory LIKE ? OR subCategory LIKE ?)'
                    const searchPhrase = `%${args.searchTerm}%`;
                    params.push(searchPhrase, searchPhrase, searchPhrase, searchPhrase);
                }

                if(args.productDisplayName) {
                    sql += ' AND productDisplayName = ?'
                    params.push(args.productDisplayName)
                }

                if (args.minPrice !== undefined && args.minPrice !== null) {
                    sql += ' AND (CAST(id AS UNSIGNED) / 10) >= ?';
                    params.push(args.minPrice);
                }

                if (args.maxPrice !== undefined && args.maxPrice !== null) {
                    sql += ' AND (CAST(id AS UNSIGNED) / 10) <= ?';
                    params.push(args.maxPrice);
                }

                if (args.sortOrder === 'price_asc') {
                    sql += ' ORDER BY CAST(id AS UNSIGNED) ASC';
                } else if (args.sortOrder === 'price_desc') {
                    sql += ' ORDER BY CAST(id AS UNSIGNED) DESC';
                }

                // Logika paginacji (LIMIT i OFFSET)
                const limit = args.limit ? Number(args.limit) : 50;
                const offset = args.offset ? Number(args.offset) : 0;

                sql += ' LIMIT ? OFFSET ?';
                params.push(limit, offset);

                const [rows]: any = await pool.execute(sql, params);
                return rows;

            } catch (error) {
                console.error("Błąd pobierania produktów:", error);
                throw new Error("Nie udało się pobrać produktów z bazy");
            }
        }
    },
    Mutation: {
        addUser: async (_, { input }) => {
            try {
                const [result]: any = await pool.execute(
                    'INSERT INTO users (login, password,first_name, last_name, phone_number, email, birth_date, gender, country, address_line1, address_line2, zip_code ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [input.username,
                        input.password,
                        input.first_name ?? null,
                        input.last_name ?? null,
                        input.phone_number ?? null,
                        input.email ?? null,
                        input.birth_date ?? null,
                        input.gender ?? null,
                        input.country ?? null,
                        input.address_line1 ?? null,
                        input.address_line2 ?? null,
                        input.zip_code ?? null]
                );

                return {
                    id: result.insertId.toString(),
                    username: input.username,
                };
            } catch (error) {
                console.error("Błąd bazy danych:", error);
                throw new Error("Nie udało się zapisać użytkownika w bazie");
            }
        },
        toggleFavorite: async (_, { userId, productId }) => {
            const [rows]: any = await pool.execute('SELECT * FROM favorites WHERE user_id = ? AND product_id = ?', [userId, productId]);
            if (rows.length > 0) {
                await pool.execute('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', [userId, productId]);
                return false;
            } else {
                await pool.execute('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)', [userId, productId]);
                return true;
            }
        },
        toggleCart: async (_, { userId, productId }) => {
            const [rows]: any = await pool.execute('SELECT * FROM cart WHERE user_id = ? AND product_id = ?', [userId, productId]);
            if (rows.length > 0) {
                await pool.execute('DELETE FROM cart WHERE user_id = ? AND product_id = ?', [userId, productId]);
                return false;
            } else {
                await pool.execute('INSERT INTO cart (user_id, product_id) VALUES (?, ?)', [userId, productId]);
                return true;
            }
        }
    }
};

const server = new ApolloServer({
    typeDefs,
    resolvers,
});

async function startServer() {
    const {url} = await startStandaloneServer(server, {
        listen: {port: 4000},
    });
    console.log(`Serwer GraphQL gotowy pod adresem: ${url}`);
}

startServer();