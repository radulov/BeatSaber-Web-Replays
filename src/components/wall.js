import {getHorizontalPosition, getHorizontalWallPosition, getVerticalPosition, rotateAboutPoint, SWORD_OFFSET} from '../utils';

// So wall does not clip the stage ground.
const RAISE_Y_OFFSET = 0.1;

const _noteLinesDistance = 0.6;
const EMPTY_ROTATION = new THREE.Euler(0, 0, 0);

/**
 * Wall to dodge.
 */
AFRAME.registerComponent('wall', {
	schema: {
		halfJumpPosition: {default: 0},
		durationSeconds: {default: 0},
		height: {default: 1.3},
		horizontalPosition: {default: 1},
		verticalPosition: {default: 0},
		isV3: {default: false},
		isCeiling: {default: false},
		speed: {default: 1.0},
		warmupPosition: {default: 0},
		width: {default: 1},
		positionOffset: {default: 0},
		spawnRotation: {default: 0},
		time: {default: 0},
		halfJumpDuration: {default: 0},
		moveTime: {default: 0},
		warmupSpeed: {default: 0},
		color: {default: null},
		scale: {default: null},
		localRotation: {default: null},
		customPosition: {default: null},
		definitePosition: {default: null},
	},

	init: function () {
		this.maxZ = 30;
		this.song = this.el.sceneEl.components.song;
		this.headset = this.el.sceneEl.querySelectorAll('.headset')[0];
		this.settings = this.el.sceneEl.components.settings;
		this.replayLoader = this.el.sceneEl.components['replay-loader'];
		this.replayPlayer = this.el.sceneEl.components['replay-player'];
	},

	getCurrentTime: function () {
		return this.settings.settings.showHitboxes ? this.replayPlayer.frameTime : this.song.getCurrentTime();
	},

	updatePosition: function () {
		const data = this.data;
		if (data.definitePosition) return;
		const halfDepth = (data.durationSeconds * data.speed) / 2;

		// Move.
		this.el.object3D.visible = true;

		var newPosition = 0;
		const currentTime = this.getCurrentTime();

		var timeOffset = data.time - currentTime - data.halfJumpDuration - data.moveTime;

		if (timeOffset <= -data.moveTime) {
			newPosition = data.halfJumpPosition - halfDepth;
			timeOffset += data.moveTime;
			newPosition += -timeOffset * data.speed;
		} else {
			newPosition = data.halfJumpPosition - halfDepth + data.warmupPosition + data.warmupSpeed * -timeOffset;
		}

		newPosition += this.headset.object3D.position.z - SWORD_OFFSET;

		var direction = this.startPosition.clone().sub(this.origin).normalize();
		this.el.object3D.position.copy(direction.multiplyScalar(-newPosition).add(this.origin));
		this.lastPosition = newPosition;

		if (this.hit && currentTime > this.hitWall.time) {
			this.hit = false;
			this.el.emit('scoreChanged', {index: this.hitWall.i}, true);
		}
	},

	onGenerate: function () {
		this.updatePosition();
	},

	update: function () {
		const el = this.el;
		const data = this.data;
		var width = data.width;
		var length = Math.abs(data.durationSeconds) * data.speed;

		this.hit = false;
		const walls = this.replayLoader.walls;

		if (walls) {
			const durationSeconds = this.data.durationSeconds;
			for (var i = 0; i < walls.length; i++) {
				if (walls[i].time < data.time + durationSeconds && walls[i].time > data.time) {
					this.hit = true;
					this.hitWall = walls[i];
					break;
				}
			}
		}

		const material = el.getObject3D('mesh').material;
		material.uniforms['highlight'].value = this.hit && this.settings.settings.highlightErrors;
		material.uniforms['wallColor'].value = new THREE.Color(data.color ? data.color : this.settings.settings.wallColor);

		const halfDepth = (data.durationSeconds * data.speed) / 2;
		var origin;
		var height = data.height;
		if (data.isV3) {
			let y = Math.max(getVerticalPosition(data.verticalPosition) + RAISE_Y_OFFSET, 0.1);
			origin = new THREE.Vector3(getHorizontalWallPosition(data.horizontalPosition), y, -SWORD_OFFSET);

			if (height < 0) {
				height *= -1;
				origin.y -= height * _noteLinesDistance;
			}
		} else {
			if (data.isCeiling) {
				let y = Math.max(getVerticalPosition(2) + RAISE_Y_OFFSET, 0.1);
				origin = new THREE.Vector3(getHorizontalWallPosition(data.horizontalPosition), y, -SWORD_OFFSET);
				height = 3;
			} else {
				let y = Math.max(getVerticalPosition(0) + RAISE_Y_OFFSET, 0.1);
				origin = new THREE.Vector3(getHorizontalWallPosition(data.horizontalPosition), y, -SWORD_OFFSET);
				height = 5;
			}
		}
		height = height * _noteLinesDistance;
		if (data.scale) {
			width = data.scale.x;
			height = data.scale.y;
			if (data.scale.z) {
				length = data.scale.z;
			}
		}
		if (data.customPosition) {
			origin = new THREE.Vector3(data.customPosition.x, data.customPosition.y + RAISE_Y_OFFSET, -SWORD_OFFSET);
		}
		if (data.definitePosition) {
			origin = data.definitePosition;
		}

		origin.y += height / 2;
		origin.x += width / 2;

		el.object3D.scale.set(Math.max(width, 0.01), Math.max(height, 0.01), Math.max(length, 0.01));
		if (!data.definitePosition) {
			el.object3D.position.set(origin.x, origin.y, origin.z + data.halfJumpPosition + data.warmupPosition - halfDepth);
		} else {
			el.object3D.position.set(origin.x, origin.y, origin.z);
		}
		el.object3D.rotation.copy(EMPTY_ROTATION);

		let axis = new THREE.Vector3(0, 1, 0);
		let theta = data.spawnRotation * 0.0175;

		origin.applyAxisAngle(axis, theta);
		this.origin = origin;

		rotateAboutPoint(el.object3D, new THREE.Vector3(0, 0, this.headset.object3D.position.z), axis, theta, true);
		el.object3D.lookAt(origin);

		if (data.localRotation) {
			el.object3D.rotateX(data.localRotation.x);
			el.object3D.rotateY(data.localRotation.y);
			el.object3D.rotateZ(data.localRotation.z);
		}

		this.startPosition = el.object3D.position.clone();
	},

	setMappingExtensionsHeight: function (startHeight, height) {
		const data = this.data;
		const el = this.el;

		const halfDepth = (data.durationSeconds * (data.speed * this.song.speed)) / 2;

		el.object3D.position.set(
			getHorizontalPosition(data.horizontalPosition) + (data.width - _noteLinesDistance) / 2,
			startHeight * 0.25 + RAISE_Y_OFFSET,
			data.halfJumpPosition + data.warmupPosition - halfDepth - SWORD_OFFSET
		);

		el.object3D.scale.set(data.width * 0.98, height * 0.3, data.durationSeconds * (data.speed * this.song.speed));
	},

	rotateAboutPoint: function (obj, point, axis, theta, pointIsWorld) {
		pointIsWorld = pointIsWorld === undefined ? false : pointIsWorld;

		if (pointIsWorld) {
			obj.parent.localToWorld(obj.position); // compensate for world coordinate
		}

		obj.position.sub(point); // remove the offset
		obj.position.applyAxisAngle(axis, theta); // rotate the POSITION
		obj.position.add(point); // re-add the offset

		if (pointIsWorld) {
			obj.parent.worldToLocal(obj.position); // undo world coordinates compensation
		}
	},

	tock: function (time, timeDelta) {
		const data = this.data;
		const halfDepth = (data.durationSeconds * data.speed) / 2;
		const currentTime = this.getCurrentTime();

		this.updatePosition();

		if (this.hit && currentTime > this.hitWall.time) {
			this.hit = false;
			this.el.emit('scoreChanged', {index: this.hitWall.i}, true);
		}

		if (this.lastPosition > this.maxZ + halfDepth) {
			this.returnToPool();
			return;
		}

		if (data.definitePosition && currentTime > data.time + data.durationSeconds) {
			this.returnToPool();
			return;
		}
	},

	returnToPool: function () {
		this.el.sceneEl.components.pool__wall.returnEntity(this.el);
		this.el.object3D.position.z = 9999;
		this.el.pause();
		this.el.removeAttribute('data-collidable-head');
		this.el.removeAttribute('raycastable-game');
	},
});
