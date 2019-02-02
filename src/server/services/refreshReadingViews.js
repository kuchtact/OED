/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const Reading = require('../models/Reading');
const stopDB = require('../models/database').stopDB;
/* tslint:disable no-console */
/**
 * Returns a Promise to refresh the reading views.
 * @returns {Promise<void>}
 */
async function refreshReadingViews() {
	console.log('Refreshing reading views');
	await Reading.refreshCompressedReadings();
	console.log('Views refreshed');
	stopDB();
}

refreshReadingViews();
